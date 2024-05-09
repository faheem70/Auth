const mongoose = require("mongoose");


const connectDatabase = () => {
  mongoose
    .connect(process.env.DB_URI || "mongodb+srv://shortLink1:ShortLink1@cluster0.uihjk1o.mongodb.net/", {
      useNewUrlParser: true,
      useUnifiedTopology: true,

    })
    .then((data) => {
      console.log(`Mongodb connected with server: ${data.connection.host}`);
    });
};

module.exports = connectDatabase;
