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

const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

console.log();

async function run() {
	try {
		const categoriesCollection = client.db('laptopCity').collection('categories');
		const userCollections = client.db('laptopCity').collection('users');

		// add users to database

		app.put('/users/:email', async (req, res) => {
			const email = req.params.email;
			const user = req.body;
			const filter = { email: email };
			const options = { upsert: true };
			const updatedDoc = {
				$set: user,
			};

			const result = await userCollections.updateOne(filter, updatedDoc, options);

			const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
			res.send({ result, token });
		});

		// check if user is seller or not

		app.get('/user/seller/:email', async (req, res) => {
			const email = req.params.email;
			const query = { email: email };
			const user = await userCollections.findOne(query);
			res.send({ isSeller: user?.role === 'Seller' });
		});

		// get categories
		app.get('/categories', async (req, res) => {
			const query = {};
			const categories = await categoriesCollection.find(query).toArray();
			res.send(categories);
		});
	} finally {
	}
}
run().catch((err) => console.log(err));

app.get('/', (req, res) => {
	res.send('Laptop city server running');
});

app.listen(port, () => {
	console.log(`Running server on ${port}`);
});
