const express = require('express');
const app = express();

require('dotenv').config();
const port = process.env.PORT || 5000;
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(express.json());
app.use(cors());





app.get('/', (req, res) => {
res.send('Laptop city server running');
});

app.listen(port, () => {
console.log(`Running server on ${port}`);
});