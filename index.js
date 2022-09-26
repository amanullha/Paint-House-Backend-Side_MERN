const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000
require('dotenv').config();
const app = express();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const jwt = require('jsonwebtoken');

// middleware
app.use(cors());

// help to convert data to json 
app.use(express.json());



app.get("/", (req, res) => {

    res.send("Running Painting Vila Server")
})

app.listen(port, () => {
    console.log("Listening to port: ", port);
})





function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" });
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {

        if (err) {
            return res.status(403).send({ message: "Forbidden access" });
        }
        req.decoded = decoded;
        next();
    })

}





const uri = "mongodb+srv://painting-vila:hQOtNTHXtHSqEHvj@cluster0.0fuk0.mongodb.net/?retryWrites=true&w=majority";
// const uri = `mongodb+srv://${process.env.USER}:${process.env.PASSWORD}@cluster0.0fuk0.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



async function run() {

    try {
        await client.connect();
        const usersCollection = client.db('paintingDB').collection('users');
        const productsCollection = client.db('paintingDB').collection('products');
        const ordersCollection = client.db('paintingDB').collection('orders');
        const reviewsCollection = client.db('paintingDB').collection('reviews');
        const paymentCollection = client.db('paintingDB').collection('payments');


        // verify admin

        const verifyAdmin = async (req, res, next) => {

            const requester = req.decoded.email;
            console.log('requester: ', requester);

            const requesterAccount = await usersCollection.findOne({ email: requester });

            if (requesterAccount?.role === 'admin') {
                next();
            }
            else {
                return res.status(403).send({ message: "Forbidden access" });

            }

        }


        // put all the users one by one
        app.put('/user/:email', async (req, res) => {


            const email = req.params.email;
            const userInfo = req.body;

            console.log('email: ', email);
            console.log('userInfo: ', userInfo);

            const filter = { email: email };

            const options = { upsert: true };

            const updateDoc = {
                $set: userInfo
            };

            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1D' })
            res.send({ result, token });
        })




        // get all the users

        app.get('/users', verifyJWT, async (req, res) => {

            const query = {};

            const users = await usersCollection.find(query).toArray();

            res.send(users);

        })

        // delete a  users
        app.delete('/users/:_id', verifyJWT, async (req, res) => {

            const _id = req.params._id;

            const query = { _id: ObjectId(_id) };

            const result = await usersCollection.deleteOne(query);

            res.send(result);

        })


        // make user to admin 
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {


            const email = req.params.email;



            const filter = { email: email };

            const updateDoc = {
                $set: { role: 'admin' }
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);



        })

        // make admin to user ro remove form admin via special admin 
        app.put('/user/remove-admin/:email', verifyJWT, verifyAdmin, async (req, res) => {


            const email = req?.params?.email;



            const filter = { email: email };

            const updateDoc = {
                $set: { role: '' }
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);



        })

        // check a user is admin or not
        app.get('/admin/:email', async (req, res) => {

            const email = req?.params?.email;
            const user = await usersCollection.findOne({ email: email })

            const isAdmin = user?.role === 'admin';

            res.send({ admin: isAdmin })
        })


        // get my profile data
        app.get('/my-profile', verifyJWT, async (req, res) => {

            const decodedEmail = req.decoded.email;

            const email = req?.query?.email;

            console.log("my-profile email: ", email);

            if (email === decodedEmail) {

                const query = { email: email };

                const myProfile = await usersCollection.findOne(query)

                res.send(myProfile);
            } else {

                res.status(403).send({ message: 'Forbidden access' })
            }



        })


        // update my profile

        app.put('/my-profile/:_id', async (req, res) => {

            const profileId = req.params._id;
            console.log("updateProfileId: ", profileId);

            const profile = req.body.profile;
            console.log("updateProfile: ", profile);

            const filter = { _id: ObjectId(profileId) };

            const options = { upsert: true };

            const updateDoc = {
                $set: {

                    education: profile.education,
                    address: profile.address,
                    phone: profile.phone,
                    linkedIn: profile.linkedIn,

                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);

            res.send(result);

        })

        // get total products count 

        app.get('/get-products-count', async (req, res) => {

            const query = {};
            const productsCount = await productsCollection.estimatedDocumentCount();
            res.send({ productsCount })
        })

        // get all the products

        app.get('/get-products', async (req, res) => {


            const currentPage = parseInt(req.query.currentPage)
            const totalProductsPerPage = parseInt(req.query.totalProductsPerPage)

            const totalSkipProducts = (currentPage - 1) * totalProductsPerPage || 0

            const query = {};
            const cursor = productsCollection.find(query);

            if (currentPage || totalProductsPerPage) {

                const products = await cursor.skip(totalSkipProducts).limit(totalProductsPerPage).toArray();

                res.send(products);
            } else {
                const products = await cursor.toArray();
                res.send(products)
            }


        })
        // get all the products for update

        app.get('/products', async (req, res) => {

            const query = {};

            const products = await productsCollection.find(query).toArray();

            console.log("porduct: ", products);

            res.send(products);

        })


        // get a single products

        app.get('/products/:productId', async (req, res) => {

            const productId = req.params.productId;
            // console.log("productId: ", productId);

            const query = { _id: ObjectId(productId) };
            // console.log("query : ", query);

            const product = await productsCollection.findOne(query);
            // console.log("product:  ", product);

            res.send(product);

        })


        // update a single products 

        app.put('/product', async (req, res) => {

            const product = req.body.product;
            console.log("updateProduct ", product);



            const filter = { _id: ObjectId(product._id) };

            const options = { upsert: true };

            const updateDoc = {
                $set: {
                    availableQuantity: product.availableQuantity,
                    minimumOrder: product.minimumOrder,
                    unitPrice: product.unitPrice

                },
            };
            const result = await productsCollection.updateOne(filter, updateDoc, options);

            res.send(result);

        })




        // update a single products quantity

        app.put('/products/:productId', async (req, res) => {

            const productId = req.params.productId;
            // console.log("productIdd: ", productId);

            const orderedQuantity = req.body.orderedQuantity;
            // console.log("orderedQuantity: ", orderedQuantity);

            const query = { _id: ObjectId(productId) };
            const product = await productsCollection.findOne(query);

            const existingQuantity = product.availableQuantity - orderedQuantity;

            const filter = { _id: ObjectId(productId) };

            const options = { upsert: true };

            const updateDoc = {
                $set: {
                    availableQuantity: existingQuantity
                },
            };
            const result = await productsCollection.updateOne(filter, updateDoc, options);

            res.send(result);

        })

        // delete a product
        app.delete('/product/:_id', verifyJWT, async (req, res) => {

            const _id = req.params._id;
            const query = { _id: ObjectId(_id) };

            // console.log("deleteProductId: ", _id);
            // console.log("deleteProductQuery: ", query);

            const result = await productsCollection.deleteOne(query)
            res.send(result);
        })




        // Add new product

        app.post('/product', async (req, res) => {

            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);

        })


        // get all the orders

        app.get('/orders', verifyJWT, verifyAdmin, async (req, res) => {

            const query = {};

            const orders = await ordersCollection.find(query).toArray();

            res.send(orders);

        })

        // Add order to the database 
        app.post('/orders', async (req, res) => {

            const order = req.body;

            const result = await ordersCollection.insertOne(order);

            return res.send(result);
        })

        // update and order payment status is true after payment to the database 
        app.patch('/order/payment-status/:_id', async (req, res) => {

            const _id = req.params._id;

            const payment = req.body;

            const filter = { _id: ObjectId(_id) };

            const updateDoc = {
                $set: {
                    paymentStatus: true,
                    transactionId: payment.transactionId,
                }
            }


            const updateResult = await ordersCollection.updateOne(filter, updateDoc);
            const paymentResult = await paymentCollection.insertOne(payment);

            return res.send(updateResult);
        })

        // get my all the orders 
        app.get('/my-orders', verifyJWT, async (req, res) => {

            const decodedEmail = req.decoded.email;

            const email = req.query.email;

            console.log("my-order email: ", email);

            if (email === decodedEmail) {

                const query = { userEmail: email };

                const myOrders = await ordersCollection.find(query).toArray();

                res.send(myOrders);
            } else {

                res.status(403).send({ message: 'Forbidden access' })
            }



        })

        // delete a order
        app.delete('/order/:_id', verifyJWT, async (req, res) => {

            const _id = req.params._id;
            const query = { _id: ObjectId(_id) };

            console.log("deleteId: ", _id);
            console.log("deleteQuery: ", query);

            const result = await ordersCollection.deleteOne(query)
            res.send(result);
        })


        // add review 
        app.post('/review', verifyJWT, async (req, res) => {

            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.send(result)
        })



        // get all the reviews

        app.get('/reviews', async (req, res) => {

            const query = {};

            const review = await reviewsCollection.find(query).toArray();

            res.send(review);

        })


        // get all the summery

        app.get('/summary', async (req, res) => {

            const query = {};

            const review = await reviewsCollection.find(query).toArray();
            const users = await usersCollection.find(query).toArray();
            const orders = await ordersCollection.find(query).toArray();
            const product = await productsCollection.find(query).toArray();

            const summary = {
                reviews: review.length,
                users: users.length,
                orders: orders.length,
                products: product.length

            }

            res.send(summary);

        })



        //payment api 

        app.post("/create-payment-intent", async (req, res) => {

            console.log("body: ", req?.body);

            const service = req?.body;
            const price = service?.price;
            const amount = price * 100;
            console.log("amount: ", amount);

            // Create a PaymentIntent with the order amount and currency

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card'],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });











    }
    finally {
        // client.close();
    }
}

run().catch(console.dir);
