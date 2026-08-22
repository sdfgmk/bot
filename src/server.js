const express = require("express");
const path = require("path");

const config = require("./config");
const db = require("./db");
const bot = require("./bot");
const x4g = require("./x4gClient");



const app = express();


// =============================
// Middleware
// =============================

app.use(
  express.json()
);


app.use(
  express.static(
    path.join(__dirname, "..", "public")
  )
);




// =============================
// API Status
// =============================

app.get(
  "/api/status/:uid",
  async (req,res)=>{

    try {

      const result =
        await x4g.getConfigStatus(
          req.params.uid
        );


      res.json(result);


    } catch(err){

      console.error(
        "STATUS ERROR:",
        err.message
      );


      res.status(500).json({
        error: err.message
      });

    }

  }
);




// =============================
// Health
// =============================

app.get(
  "/health",
  (req,res)=>{

    res.json({
      ok:true
    });

  }
);




// =============================
// Status Page
// =============================

app.get(
  "/status",
  (req,res)=>{

    res.sendFile(
      path.join(
        __dirname,
        "..",
        "public",
        "status.html"
      )
    );

  }
);




// =============================
// Start Application
// =============================


async function start(){


  try {


    console.log(
      "Starting application..."
    );



    if(!config.BOT_TOKEN){

      throw new Error(
        "BOT_TOKEN موجود نیست"
      );

    }



    console.log(
      "Connecting database..."
    );


    await db.connectDB();



    console.log(
      "Database seed..."
    );


    await db.seed();




    // -------------------------
    // Telegram
    // -------------------------


    if(
      !bot ||
      !bot.telegram
    ){

      throw new Error(
        "Bot درست export نشده است"
      );

    }



    console.log(
      "Removing webhook..."
    );


    try {


      await bot.telegram.deleteWebhook(
        {
          drop_pending_updates:true
        }
      );


      console.log(
        "Webhook removed"
      );


    } catch(err){

      console.log(
        "Webhook remove failed:",
        err.message
      );

    }




    console.log(
      "Launching telegram bot..."
    );


    await bot.launch();



    console.log(
      "Telegram bot started ✅"
    );





    // -------------------------
    // Express
    // -------------------------


    app.listen(
      config.PORT,
      "0.0.0.0",
      ()=>{

        console.log(
          `Server running on ${config.PORT} ✅`
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




start();




// =============================
// Shutdown
// =============================


function shutdown(signal){


  console.log(
    `Stopping ${signal}...`
  );


  try{

    bot.stop(signal);

  }catch(e){}


  process.exit(0);


}



process.once(
  "SIGINT",
  ()=>shutdown("SIGINT")
);


process.once(
  "SIGTERM",
  ()=>shutdown("SIGTERM")
);