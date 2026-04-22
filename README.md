# WhatsApp AI SaaS Application

## A) PROJECT OVERVIEW
This project is a powerful AI-driven WhatsApp SaaS application. It provides an automated, intelligent communication system over WhatsApp using Baileys and OpenAI/Groq, combined with a robust dashboard built on Next.js. 

### Key Features
- **Automated AI WhatsApp Responses**: Interact with customers via AI-generated text and voice notes.
- **Real-time Dashboard**: Live chat synchronization and dashboard updates via Socket.IO.
- **Firebase Integration**: Secure user authentication and database management.
- **Stripe Payments**: Subscription and billing handling.
- **WebRTC AI Calling**: High-quality voice interactions and voice note processing.

---

## B) LOCAL DEVELOPMENT SETUP

Follow these steps to run both the frontend and backend locally.

### Frontend Setup
1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Environment Variables:**
   Create a `.env.local` file in the `frontend` folder and add your environment variables (e.g., Firebase config, Backend API URL):
   ```env
   NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
   # Add your Firebase and other necessary frontend keys here
   ```
4. **Run the development server:**
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`.

### Backend Setup
1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Environment Variables:**
   Create a `.env` file in the `backend` folder and add your necessary environment variables:
   ```env
   PORT=5000
   FRONTEND_URL=http://localhost:3000
   OPENAI_API_KEY=your_openai_api_key
   # Add your Firebase Admin SDK, Stripe, and other backend keys here
   ```
4. **Run the backend development server:**
   ```bash
   npm run dev
   ```
   The backend will be running at `http://localhost:5000`.

---

## C) DEPLOYMENT GUIDE (PRODUCTION)

### 1. Frontend Deployment (Vercel)
Vercel is highly recommended for Next.js applications.

1. **Push to GitHub**: Make sure your code is pushed to a GitHub repository.
2. **Import Project**: Go to your Vercel Dashboard and click "Add New..." -> "Project".
3. **Select Repository**: Connect your GitHub account and import your repository.
4. **Configure Project**:
   - **Framework Preset**: Next.js (should be automatically detected).
   - **Root Directory**: Select `frontend`.
5. **Environment Variables**: Add all the variables from your `.env.local` file into the Vercel Environment Variables section.
6. **Deploy**: Click the "Deploy" button. Vercel will build and deploy your frontend.

### 2. Backend Deployment (Railway)
Railway is an excellent platform for hosting Node.js/Socket.IO backends.

1. **Dashboard**: Go to your Railway Dashboard and click "New Project".
2. **Deploy from GitHub**: Select "Deploy from GitHub repo" and choose your repository.
3. **Root Directory setup**: 
   - Once deployed, go to the project settings.
   - Set the **Root Directory** to `/backend`.
4. **Start Command**: Railway will automatically use the `"start": "tsx src/server.ts"` script provided in the backend `package.json`.
5. **Environment Variables**: Go to the "Variables" tab in Railway and add all your variables from the backend `.env` file (e.g., `FRONTEND_URL`, API Keys). Make sure to set `FRONTEND_URL` to your newly deployed Vercel domain.
6. **Generate Domain**: Go to "Settings" -> "Networking" and click "Generate Domain" to get a public HTTPS URL for your backend.

---

## D) PROJECT STRUCTURE

```text
ai-701/
├── frontend/             # Next.js Frontend Application
│   ├── src/              # Source code (components, pages, styles)
│   ├── public/           # Static assets
│   ├── package.json      # Frontend dependencies
│   └── next.config.mjs   # Next.js configuration
│
├── backend/              # Node.js/Express Backend Application
│   ├── src/              # Server logic, routes, controllers, Socket.IO
│   ├── package.json      # Backend dependencies
│   └── .env              # Environment configurations (not committed)
│
└── README.md             # Project documentation
```

---

## E) IMPORTANT NOTES

- **Environment Variables**: NEVER commit your `.env` or `.env.local` files to GitHub. They are ignored by Git. Make sure to accurately copy them into your Vercel and Railway dashboards.
- **CORS Configuration**: The backend must allow connections from your Vercel domain. Ensure that your CORS settings in the backend (often in `src/server.ts` or `app.js`) use the `FRONTEND_URL` environment variable to dynamically allow the frontend's origin.
- **WebSocket Connection**: Socket.IO in the frontend must point to the Railway-generated domain URL once deployed. Ensure that the socket connection utilizes the `NEXT_PUBLIC_BACKEND_URL` variable.
- **WhatsApp Authentication**: When deploying on Railway, the WhatsApp web session data generated by Baileys will be saved in Railway's ephemeral file system. Consider using a persistent volume on Railway or storing the authentication state in a cloud database to avoid having to re-scan the QR code upon every Railway redeployment.
