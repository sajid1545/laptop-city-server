const express = require('express');
const app = express();

require('dotenv').config();
const port = process.env.PORT || 5000;
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SK);

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

function verifyJWT(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		res.send(401).send({ message: 'Invalid authorization ' });
	}

	const token = authHeader.split(' ')[1];
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			res.send(403).send({ message: 'Forbidden Access ' });
		}
		req.decoded = decoded;
		next();
	});
}

async function run() {
	try {
		const categoriesCollection = client.db('laptopCity').collection('categories');
		const userCollections = client.db('laptopCity').collection('users');
		const productCollections = client.db('laptopCity').collection('products');
		const orderCollections = client.db('laptopCity').collection('orders');
		const paymentCollection = client.db('laptopCity').collection('payment');

		// get all users from product info

		app.get('/user/products/:id', async (req, res) => {
			// const email = req.query.email;
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const product = await productCollections.findOne(filter);
			const userEmail = product.userEmail;
			const query = { email: userEmail };
			const user = await userCollections.findOne(query);

			res.send({ product, user });
		});

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
		app.get('/user/seller/:email', verifyJWT, async (req, res) => {
			const email = req.params.email;
			const query = { email: email };
			const user = await userCollections.findOne(query);
			res.send({ isSeller: user?.role === 'Seller' });
		});

		// check if user is admin or not
		app.get('/user/admin/:email', verifyJWT, async (req, res) => {
			const email = req.params.email;
			const query = { email: email };
			const user = await userCollections.findOne(query);
			res.send({ isAdmin: user?.role === 'admin' });
		});

		// get categories
		app.get('/categories', verifyJWT, async (req, res) => {
			const query = {};
			const categories = await categoriesCollection.find(query).toArray();
			res.send(categories);
		});

		// get products
		app.get('/products/category/:id', async (req, res) => {
			const id = req.params.id;
			const query = { categoryId: id };
			const product = await productCollections.find(query).toArray();
			res.send(product);
		});

		// getProducts posted by which user

		// api for adding products
		app.post('/products', verifyJWT, async (req, res) => {
			const product = req.body;

			const result = await productCollections.insertOne(product);

			res.send(result);
		});

		// get booked products of using by filtering using user email
		app.get('/book-product', verifyJWT, async (req, res) => {
			const email = req.query.email;
			const query = { email: email };
			const booking = await orderCollections.find(query).toArray();
			res.send(booking);
		});

		// get single booked product so that user can pay for it
		app.get('/book-product/:id', async (req, res) => {
			const id = req.params.id;
			const query = { _id: ObjectId(id) };
			const booked = await orderCollections.findOne(query);
			res.send(booked);
		});

		// add users booking to database
		app.post('/book-product', verifyJWT, async (req, res) => {
			const product = req.body;
			const result = await orderCollections.insertOne(product);
			res.send(result);
		});

		// get seller products
		app.get('/seller-products', verifyJWT, async (req, res) => {
			const email = req.query.email;

			const userQuery = { email: email };
			const user = await userCollections.findOne(userQuery);
			if (user?.role !== 'Seller') {
				return res.status(403).send({ message: 'Forbidden Access' });
			}

			const query = { userEmail: email };
			const products = await productCollections.find(query).toArray();
			res.send(products);
		});

		// delete seller product which is already sold out

		app.delete('/seller-products/:id', verifyJWT, async (req, res) => {
			const id = req.params.id;
			const query = { _id: ObjectId(id) };

			const result = await productCollections.deleteOne(query);
			res.send(result);
		});

		// for payment
		app.post('/create-payment-intent', async (req, res) => {
			const order = req.body;
			const price = order.price;
			const amount = price;

			// Create a PaymentIntent with the order amount and currency
			const paymentIntent = await stripe.paymentIntents.create({
				amount: amount,
				currency: 'usd',
				automatic_payment_methods: {
					enabled: true,
				},
			});

			res.send({
				clientSecret: paymentIntent.client_secret,
			});
		});

		// store payment info to database
		app.post('/payments', async (req, res) => {
			const payment = req.body;
			const result = await paymentCollection.insertOne(payment);
			console.log(payment);
			const id = payment.productId;
			const filter = { _id: ObjectId(id) };
			const updatedDoc = {
				$set: {
					paid: true,
				},
			};

			const updatedResult = await productCollections.updateOne(filter, updatedDoc);

			const query = { productId: id };
			const updatedResult2 = await orderCollections.updateOne(query, updatedDoc);

			res.send(result);
		});

		// get all seller users
		app.get('/all-sellers', verifyJWT, async (req, res) => {
			const query = { role: 'Seller' };
			const user = await userCollections.find(query).toArray();
			res.send(user);
		});

		// delete seller
		app.delete('/all-sellers/:id', verifyJWT, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const result = await userCollections.deleteOne(filter);
			res.send(result);
		});

		// get all buyers
		app.get('/all-buyers', verifyJWT, async (req, res) => {
			const query = { role: 'buyer' };
			const buyer = await userCollections.find(query).toArray();
			res.send(buyer);
		});

		// delete buyer
		app.delete('/all-buyers/:id', verifyJWT, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const result = await userCollections.deleteOne(filter);
			res.send(result);
		});

		// advertise product

		// the reson of using display-home-product is If your URL contains words such as "advert", "ad", "doubleclick", "click", or something similar Then ad-blocker will block it.
		app.put('/display-home-product/:id', verifyJWT, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			console.log(filter);
			const options = { upsert: true };
			const updatedDoc = {
				$set: {
					productStatus: true,
				},
			};
			const result = await productCollections.updateOne(filter, updatedDoc, options);
			res.send(result);
		});

		// get advertised Product
		app.get('/display-home-product', verifyJWT, async (req, res) => {
			const query = { productStatus: true };
			const products = await productCollections.find(query).toArray();
			res.send(products);
		});

		// post reported-items
		app.put('/reported-items/:id', async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const updatedDoc = {
				$set: {
					reported: true,
				},
			};

			const result = await productCollections.updateOne(filter, updatedDoc);
			res.send(result);
		});

		// get reported items
		app.get('/reported-items', verifyJWT, async (req, res) => {
			const query = { reported: true };
			const reportedItems = await productCollections.find(query).toArray();
			res.send(reportedItems);
		});

		// delete reportedItems
		app.delete('/reported-items/:id', verifyJWT, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const result = await productCollections.deleteOne(filter);
			res.send(result);
		});

		// verifyUser
		app.put('/verify-user/:id', verifyJWT, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const updatedDoc = {
				$set: {
					verified: true,
				},
			};
			const result = await userCollections.updateOne(filter, updatedDoc);
			res.send(result);
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
