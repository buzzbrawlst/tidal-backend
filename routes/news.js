const router=require("express").Router();
const fs=require("fs");

router.get("/",(req,res)=>{

const news=JSON.parse(
fs.readFileSync("./news/news.json")
);

res.json(news);

});

module.exports=router;