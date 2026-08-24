# Deployment Guide: How to launch Peak for free in 5 minutes!

This project is perfectly optimized for modern PaaS platforms. We will deploy the Database + Backend to **Render.com** and the Frontend to **Vercel.com**.

## Step 1: Deploy Backend & Database (Render)
Render allows us to use "Infrastructure as Code" via the `render.yaml` file I created in your `backend` folder.

1. Create a free account on [Render.com](https://render.com) using your GitHub.
2. Go to your Dashboard and click **New -> Blueprint**.
3. Connect your GitHub repository.
4. Render will automatically read the `backend/render.yaml` file and instantly spin up:
   - A free PostgreSQL Database.
   - Your FastAPI Web Service.
   - Your Python Worker Service.
5. Wait a few minutes for them to deploy. Once the Web Service is live, copy its URL (e.g., `https://peak-api-xyz.onrender.com`).

## Step 2: Deploy Frontend (Vercel)
Vercel is the ultimate platform for Next.js. 

1. Create a free account on [Vercel.com](https://vercel.com) using your GitHub.
2. Click **Add New -> Project** and select your GitHub repository.
3. Set the **Root Directory** to `frontend`.
4. Open the **Environment Variables** section and add these two keys:
   - `NEXT_PUBLIC_API_URL`: Paste the Render URL you copied earlier (e.g., `https://peak-api-xyz.onrender.com`).
   - `NEXT_PUBLIC_WS_URL`: Paste the same URL but with `wss://` at the start and `/ws` at the end (e.g., `wss://peak-api-xyz.onrender.com/ws`).
5. Click **Deploy**.

**That's it!** You now have a fully functional, live URL for your React dashboard that communicates with your cloud backend and cloud worker. 

Share that Vercel link with your recruiter and watch them be amazed!
