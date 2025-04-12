import express from 'express';
import env from 'dotenv';
import pg from 'pg';
import cors from 'cors';
import admin from 'firebase-admin';
import { encrypt, decrypt } from './utils/cryptoUtils.js';
import axios from 'axios';

env.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Render
  },
})

db.connect();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


app.post('/api/auth/firebase-login', async (req, res) => {
    const { token } = req.body;
  
    try {
      const decoded = await admin.auth().verifyIdToken(token);
  
      const {
        name,
        email,
        picture: photo,
        user_id: uid,
        firebase: { sign_in_provider: provider },
      } = decoded;
  
      const fallbackEmail = email || `${uid}@firebaseuser.local`;
      const fallbackName = name || 'Anonymous';
  
      const encryptedEmail = encrypt(fallbackEmail);
      const encryptedName = encrypt(fallbackName);
  
      // 🔁 UPSERT user (login or signup in one)
      const result = await db.query(
        `
        INSERT INTO users (userid, name, email, photo, provider)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (userid) DO UPDATE
        SET name = EXCLUDED.name,
            email = EXCLUDED.email,
            photo = EXCLUDED.photo,
            provider = EXCLUDED.provider
        RETURNING *;
        `,
        [uid, encryptedName, encryptedEmail, photo, provider]
      );
  
      // 🧠 Optional: decrypt before sending back
      const user = result.rows[0];
      const decryptedUser = {
        ...user,
        name: decrypt(user.name),
        email: decrypt(user.email),
      };
  
      res.status(200).json({
        message: 'User logged in successfully',
        user: decryptedUser,
      });
  
    } catch (error) {
      console.error('❌ Firebase token verification failed:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Fetch news
  app.get('/api/news', async (req, res) => {
    try {
      const response = await axios.get(
        'https://gnews.io/api/v4/search?q=bitcoin&lang=en&token=dbc3aae76e5d9cc0421e01652e8c407f'
      );
      // console.log(response.data)
      res.json(response.data); // forward the data to frontend
    } catch (error) {
      console.error('Failed to fetch news:', error.message);
      res.status(500).json({ error: 'Failed to fetch news' });
    }
  });

  // Fetch stocks
app.get('/api/stocks', async (req, res) => {
  try {
    const symbols = [
      "TSLA", "META", "NFLX", "AMD", "INTC",
      "BA", "UBER", "PYPL", "ADBE", "DIS",
      "JPM", "V", "KO", "PEP", "MRNA",
      "COST", "WMT", "XOM", "GS", "NKE"
    ];

    const apiKey = 'accWUCnRtb63IfVNN3CsFB8nIF9kBgmw';
    const url = `https://financialmodelingprep.com/api/v3/profile/${symbols}?apikey=${apiKey}`;

    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch stock data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

  



app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})
