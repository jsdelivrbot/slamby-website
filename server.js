/// <reference path="./typings/index.d.ts" />
"use strict";
var path = require('path');
var express = require('express');
var connect = require('connect');
var http = require('http');
var config = require('config');
var slambySdk = require('slamby-sdk');
var Guid = require('guid');
var bodyParser = require('body-parser');
//Cache manager
var NodeCache = require("node-cache");
var isDeveloping = process.env.NODE_ENV !== 'production';
var port = isDeveloping ? 3000 : 3000;
var app = express();
//gzip enabled
app.use(connect.compress());
//Body Parsing.
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
//Cache enabled
app.set('view cache', true);
//Static folders
app.use('/build', express.static(__dirname + '/build'));
app.use('/app', express.static(__dirname + '/app'));
app.use('/node_modules', express.static(__dirname + '/node_modules'));
var myCache = new NodeCache({ stdTTL: 600, checkperiod: 600 });
function getJobs() {
    http.get(config.get("cms.jobService"), function (res) {
        var body = '';
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', function () {
            myCache.set("jobs", body, function (err, success) {
                if (!err && success) {
                    console.log(success);
                }
            });
        });
    }).on('error', function (e) {
        console.log("Got an error: ", e);
    });
}
;
myCache.on("expired", function (key, value) {
    console.log(key + " expired");
    getJobs();
});
app.get('/api/jobservice', function (req, response) {
    myCache.get("jobs", function (err, value) {
        if (!err) {
            if (value == undefined) {
                console.log("undifined");
                response.status(404).send("Job List Not Available");
            }
            else {
                response.send(value);
            }
        }
    });
});
app.get('/api/jobservice/:id*', function (req, response) {
    var id = req.params.id;
    var result = false;
    myCache.get("jobs", function (err, value) {
        if (!err) {
            var object = JSON.parse(value);
            object.forEach(function (element) {
                if (element.id == id) {
                    result = true;
                    response.send(JSON.stringify(element));
                }
                ;
            });
        }
    });
    if (!result) {
        response.status(404).send('{"error":"Job Not Found"}');
    }
});
function AddDocument(server, secret, dataset, document) {
    var client = new slambySdk.ApiClient();
    client.basePath = server;
    client.defaultHeaders = {
        "Authorization": "Slamby " + secret
    };
    client.defaultHeaders["X-DataSet"] = dataset;
    var apiInstance = new slambySdk.DocumentApi(client);
    var opts = { "document": document };
    return apiInstance.createDocument(opts);
}
;
app.post('/api/subscribe/community', function (req, res) {
    AddDocument(config.get("accounts.community.server"), config.get("accounts.community.secret"), config.get("accounts.community.dataset"), req.body.document).then(function () {
        console.log("added");
        res.send("Succesfully Added");
    }, function (error) {
        console.log(error);
        res.status(409).send(error);
    });
});
app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.listen(port, '0.0.0.0', function (err) {
    if (err) {
        console.log(err);
    }
    console.info('==> Server is running on http://localhost:%s/', port);
});
getJobs();
