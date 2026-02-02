const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiting to all API routes
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 API requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many API requests, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(limiter);
app.use('/api', apiLimiter);
app.use(express.static(path.join(__dirname, 'public')));

// VAPID keys for secure push notifications
// These MUST be set via environment variables in production
// Generate new keys with: npx web-push generate-vapid-keys
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('WARNING: VAPID keys not set in environment variables.');
    console.warn('For development, default keys will be used.');
    console.warn('In production, set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.');
}

const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || 'BMuo9urQs3EuP6h224RIbk90TYEI3heIdMCX-gNuFO-eov7fKTBrfD4EpxBNTyIwxIM1JTmxxo8U_-llSza0CTs',
    privateKey: process.env.VAPID_PRIVATE_KEY || 'oJIbqmKTzXzm-jFLJPvDsM0G8_6TU9hXLVuICsJeog8'
};

// Configure web-push with VAPID details
webpush.setVapidDetails(
    'mailto:breads@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Store subscriptions in memory (in production, use a database)
const subscriptions = new Map();

// Helper function to generate a secure subscription ID
function generateSubscriptionId(endpoint) {
    return crypto.createHash('sha256').update(endpoint).digest('hex');
}

// Endpoint to get VAPID public key
app.get('/api/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

// Endpoint to subscribe to push notifications
app.post('/api/subscribe', (req, res) => {
    const subscription = req.body;
    
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription' });
    }
    
    // Store the subscription using a secure hash of the endpoint
    const subscriptionId = generateSubscriptionId(subscription.endpoint);
    subscriptions.set(subscriptionId, subscription);
    
    console.log('New subscription registered:', subscriptionId.substring(0, 16) + '...');
    res.status(201).json({ message: 'Subscription registered successfully', id: subscriptionId });
});

// Endpoint to unsubscribe from push notifications
app.post('/api/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    
    if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint is required' });
    }
    
    const subscriptionId = generateSubscriptionId(endpoint);
    subscriptions.delete(subscriptionId);
    
    console.log('Subscription removed:', subscriptionId);
    res.json({ message: 'Unsubscribed successfully' });
});

// Endpoint to schedule a notification for a recipe stage
app.post('/api/schedule-notification', async (req, res) => {
    const { subscriptionId, stageName, startTime, delay } = req.body;
    
    if (!subscriptionId || !stageName || !startTime) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const subscription = subscriptions.get(subscriptionId);
    
    if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
    }
    
    const notificationPayload = JSON.stringify({
        title: '🍞 Bread Stage Reminder',
        body: `Time to start: ${stageName}`,
        icon: '/bread-icon.png',
        data: {
            stageName,
            startTime
        }
    });
    
    // Calculate delay until notification should be sent
    // We subtract the "notify before" time so users get notified ahead of the stage start
    const notifyAt = new Date(startTime);
    const now = new Date();
    const delayMs = Math.max(0, notifyAt.getTime() - now.getTime() - (delay || 0) * 60 * 1000);
    
    if (delayMs > 0) {
        // Schedule the notification using setTimeout
        // Note: In production, consider using a persistent job queue (e.g., Bull, Agenda)
        // as setTimeout-based scheduling is lost on server restart
        setTimeout(async () => {
            try {
                await webpush.sendNotification(subscription, notificationPayload);
                console.log('Scheduled notification sent for:', stageName);
            } catch (error) {
                console.error('Error sending scheduled notification:', error);
                if (error.statusCode === 410) {
                    // Subscription has expired or is no longer valid
                    subscriptions.delete(subscriptionId);
                }
            }
        }, delayMs);
        
        res.json({ message: `Notification scheduled for ${stageName}`, scheduledAt: notifyAt });
    } else {
        // Send immediately if the time has passed
        try {
            await webpush.sendNotification(subscription, notificationPayload);
            res.json({ message: 'Notification sent immediately', stageName });
        } catch (error) {
            console.error('Error sending notification:', error);
            res.status(500).json({ error: 'Failed to send notification' });
        }
    }
});

// Endpoint to send a test notification
app.post('/api/test-notification', async (req, res) => {
    const { subscriptionId } = req.body;
    
    if (!subscriptionId) {
        return res.status(400).json({ error: 'Subscription ID is required' });
    }
    
    const subscription = subscriptions.get(subscriptionId);
    
    if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
    }
    
    const notificationPayload = JSON.stringify({
        title: '🍞 Bread Banking Planner',
        body: 'Push notifications are working!',
        icon: '/bread-icon.png'
    });
    
    try {
        await webpush.sendNotification(subscription, notificationPayload);
        res.json({ message: 'Test notification sent successfully' });
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`VAPID Public Key: ${vapidKeys.publicKey}`);
});
