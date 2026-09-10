const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const NEWS_FILE = path.join(__dirname, "../news/news.json");

// Read news
function getNews() {
    if (!fs.existsSync(NEWS_FILE)) return [];
    return JSON.parse(fs.readFileSync(NEWS_FILE, "utf8"));
}

// Save news
function saveNews(news) {
    fs.writeFileSync(
        NEWS_FILE,
        JSON.stringify(news, null, 2)
    );
}

// =====================================
// PUBLIC - GET NEWS
// =====================================
router.get("/", (req, res) => {
    res.json(getNews());
});

// =====================================
// ADMIN AUTH MIDDLEWARE
// =====================================
function requireAdmin(req, res, next) {
    const secret = req.header("x-tidal-admin-secret");

    if (
        !secret ||
        secret !== process.env.BACKEND_ADMIN_SECRET
    ) {
        return res.status(403).json({
            error: "Admin access required."
        });
    }

    next();
}

// =====================================
// ADMIN - CREATE NEWS
// =====================================
router.post("/", requireAdmin, (req, res) => {
    const news = getNews();

    const post = {
        id: Date.now().toString(),
        title: req.body.title,
        description: req.body.description,
        category: req.body.category || "Launcher",
        image: req.body.image || "",
        date: new Date().toLocaleDateString("en-GB")
    };

    news.unshift(post);

    saveNews(news);

    res.json(post);
});

// =====================================
// ADMIN - DELETE NEWS
// =====================================
router.delete("/:id", requireAdmin, (req, res) => {
    const news = getNews();

    const filtered = news.filter(
        n => n.id !== req.params.id
    );

    saveNews(filtered);

    res.json({
        success: true
    });
});

module.exports = router;
