const express = require("express");
const path = require("path");

const config = require("./config");
const x4g = require("./x4gClient");
const bot = require("./bot");
const db = require("./db");


const app = express();


// ─────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "..", "public")
  )
);



// ─────────────────────────────────────────
// API وضعیت کانفیگ
// ─────────────────────────────────────────

app.get("/api/status/:uid", async (req, res) => {

  try {

    const data =
      await x4g.getConfigStatus(
        req.params.uid
      );


    res.json(data);


  } catch (err) {

    console.log(
      "STATUS API ERROR:",
      err.message
    );


    res.status(502).json({
      error: err.message
    });

  }

});




// ─────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────

app.get("/health", (req, res) => {

  res.json({
    ok:true
  });

});




// ─────────────────────────────────────────
// صفحه وضعیت سرویس
// ─────────────────────────────────────────

app.get("/status", (req,res)=>{

  res.sendFile(
    path.join(
      __dirname,
      "..",
      "public",
      "status.html"
    )
  );

});




// ─────────────────────────────────────────
// Start Bot + Server
// ─────────────────────────────────────────

async function main(){

  try {


    if(!config.BOT_TOKEN){

      throw new Error(
        "BOT_TOKEN تنظیم نشده است."
      );

    }



    console.log(
      "Connecting database..."
    );


    await db.connectDB();



    console.log(
      "Seeding database..."
    );


    await db.seed();



    console.log(
      "Removing old webhook..."
    );


    await bot.telegram.deleteWebhook({

      drop_pending_updates:true

    });



    console.log(
      "Starting Telegram bot..."
    );


    await bot.launch();



    console.log(
      "✅ Bot polling started"
    );



    app.listen(

      config.PORT,

      "0.0.0.0",

      ()=>{

        console.log(
          `✅ Web server started on port ${config.PORT}`
        );

      }

    );



  } catch(err){


    console.error(
      "START ERROR:",
      err
    );


    process.exit(1);

  }

}




main();




// ─────────────────────────────────────────
// Shutdown
// ─────────────────────────────────────────

process.once(
  "SIGINT",
  ()=>{
    console.log("Stopping bot...");
    bot.stop("SIGINT");
  }
);


process.once(
  "SIGTERM",
  ()=>{
    console.log("Stopping bot...");
    bot.stop("SIGTERM");
  }
);