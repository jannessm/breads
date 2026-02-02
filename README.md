# Bread Banking Planner

## Overview
A web application to help bakers plan and track bread recipe stages with precise timing and push notifications.

## Features
- Add recipe stages with custom names and durations
- Calculate consecutive start times
- Save and load recipes using local storage
- Delete existing recipes
- **Push notifications** to remind you when each stage should start
- Beautiful responsive UI with TailwindCSS

## How to Use
1. Enter a recipe name
2. Add stages with their names and durations
3. Set a start time to calculate stage timings
4. Enable push notifications to get reminders
5. Save the recipe for future reference

## Running the Application

### With Push Notifications (Backend Required)
```bash
npm install
npm start
```
Then open http://localhost:3000 in your browser.

### Static Version (GitHub Pages)
The `index.html` file in the root directory can be opened directly in a browser or deployed to GitHub Pages for a static version without push notifications.

## Technologies
- HTML5
- JavaScript
- TailwindCSS
- Node.js with Express
- Web Push API for notifications
- Local Storage API

## Environment Variables (Optional)
For production, set these environment variables:
- `VAPID_PUBLIC_KEY`: Your VAPID public key
- `VAPID_PRIVATE_KEY`: Your VAPID private key
- `PORT`: Server port (default: 3000)

## Deployment
- **Static**: Deploy to GitHub Pages using the root `index.html`
- **With Backend**: Deploy the Node.js server to platforms like Heroku, Railway, or Render
