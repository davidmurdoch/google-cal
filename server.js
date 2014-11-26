var express = require("express");
var expressLess = require("express-less");
var app = express();

app.use(express.static(__dirname + '/public'));
app.use('/css', expressLess(__dirname + '/public/less', { debug: true }));


app.listen(process.env.PORT || 3000, process.env.IP || "127.0.0.1");