const express = require("express");
const fs = require("fs");
const { Sequelize, DataTypes } = require("sequelize");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function loadFile() {
  return JSON.parse(fs.readFileSync("./products.json", "utf8"));
}

let fileData = loadFile();
let products = fileData.products;
let count = fileData.count;

const fsRouter = express.Router();
const dbRouter = express.Router();

app.use("/fs", fsRouter);
app.use("/db", dbRouter);

app.get("/404", (req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// ===== MIDDLEWARE =====
function productExists(req, res, next) {
  const id = Number(req.params.id);
  const data = loadFile();
  const found = data.products.find(p => p.id === id);

  if (!found) return res.redirect("/404");

  req.data = data;
  next();
}

function validateProduct(req, res, next) {
  const { name, category, price } = req.body;
  if (!name || !category || price === undefined) {
    return res.status(400).json({ message: "Invalid product data" });
  }
  next();
}

fsRouter.get("/products", (req, res) => {
  let result = [...products];

  if (req.query.category)
    result = result.filter(p => p.category === req.query.category);

  if (req.query.subcategory)
    result = result.filter(p => p.subcategory === req.query.subcategory);

  if (req.query.search)
    result = result.filter(p =>
      p.name.toLowerCase().includes(req.query.search.toLowerCase())
    );

  res.json(result);
});

fsRouter.get("/products/:id", productExists, (req, res) => {
  const id = Number(req.params.id);
  const product = req.data.products.find(p => p.id === id);
  res.json(product);
});

fsRouter.post("/products", (req, res) => {
  const lastId = products.length ? products[products.length - 1].id : 0;

  const newProduct = {
    id: lastId + 1,
    name: req.body.name,
    category: req.body.category,
    subcategory: req.body.subcategory,
    price: req.body.price
  };

  products.push(newProduct);
  count = products.length;

  fs.writeFileSync("./products.json", JSON.stringify({ count, products }, null, 2));

  res.status(201).json({ message: "Product created", product: newProduct });
});

fsRouter.put("/products/:id", productExists, validateProduct, (req, res) => {
  const id = Number(req.params.id);
  const product = products.find(p => p.id === id);

  Object.assign(product, req.body);

  fs.writeFileSync("./products.json", JSON.stringify({ count, products }, null, 2));

  res.json({ message: "Product updated", product });
});

fsRouter.delete("/products/:id", productExists, (req, res) => {
  const id = Number(req.params.id);
  products = products.filter(p => p.id !== id);
  count = products.length;

  fs.writeFileSync("./products.json", JSON.stringify({ count, products }, null, 2));

  res.status(204).send();
});

const conn = new Sequelize("products_inventory", "root", "12345678", {
  host: "localhost",
  dialect: "mysql"
});

const Category = conn.define("Category", {
  name: { type: DataTypes.STRING, allowNull: false, unique: true }
});

const SubCategory = conn.define("SubCategory", {
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  category_id: { type: DataTypes.INTEGER, allowNull: false }
});

const Product = conn.define("Product", {
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  price: { type: DataTypes.DOUBLE.UNSIGNED, allowNull: false, defaultValue: 0 },
  currency: { type: DataTypes.STRING, defaultValue: "USD" },
  stock: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  rating: { type: DataTypes.FLOAT.UNSIGNED, defaultValue: 1 },
  subcategory_id: { type: DataTypes.INTEGER, allowNull: false }
});

SubCategory.belongsTo(Category, { foreignKey: "category_id" });
Product.belongsTo(SubCategory, { foreignKey: "subcategory_id" });

dbRouter.get("/products", async (req, res) => {
  const dbProducts = await Product.findAll();
  res.json(dbProducts);
});

dbRouter.get("/products/:id", async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});

dbRouter.post("/products", async (req, res) => {
  const created = await Product.create(req.body);
  res.status(201).json({ message: "Product created", product: created });
});

dbRouter.put("/products/:id", async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  Object.assign(product, req.body);
  await product.save();

  res.json({ message: "Product updated", product });
});

dbRouter.delete("/products/:id", async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  await product.destroy();
  res.status(204).send();
});

async function fillInCategories() {
  const { products } = loadFile();
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

  for (const c of categories) {
    await Category.findOrCreate({ where: { name: c } });
  }

  await fillInSubcategories(products);
}

async function fillInSubcategories(products) {
  const map = new Map();

  for (const p of products) {
    if (!p.subcategory || !p.category) continue;
    map.set(p.subcategory, p.category);
  }

  for (const [sub, cat] of map) {
    const parent = await Category.findOne({ where: { name: cat } });
    if (!parent) continue;

    await SubCategory.findOrCreate({
      where: {
        name: sub,
        category_id: parent.id
      }
    });
  }
}

async function fillInProducts() {
  await fillInCategories();
  const { products } = loadFile();

  for (const p of products) {
    if (!p.subcategory) continue;

    const sub = await SubCategory.findOne({
      where: { name: p.subcategory }
    });

    if (!sub) continue;

    await Product.findOrCreate({
      where: { name: p.name },
      defaults: {
        price: p.price ?? 0,
        currency: p.currency ?? "USD",
        stock: p.stock ?? 0,
        rating: p.rating ?? 1,
        subcategory_id: sub.id
      }
    });
  }
}

app.listen(9000, () => { console.log("Server running on port 9000"); 

});