require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// News route
app.use("/news", require("./routes/news.js"));

// Discord authentication route
app.use("/auth", require("./routes/auth.js"));

app.get("/", (req, res) => {
    res.json({
        name: "Tidal Backend",
        status: "Online 🌊",
        version: "1.0.0"
    });
});

// Simple backend status endpoint
app.get("/status", (req, res) => {
    res.json({
        online: true,
        backend: "Tidal Backend",
        version: "1.0.0"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🌊 Backend running on port ${PORT}`);
});