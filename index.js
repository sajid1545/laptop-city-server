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

// database



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.59reojt.mongodb.net/?retryWrites=true&w=majority`;

console.log(uri);

const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

app.get('/', (req, res) => {
	res.send('Laptop city server running');
});

app.listen(port, () => {
	console.log(`Running server on ${port}`);
});
