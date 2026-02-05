const express = require("express")
const app = express()
const fs = require("fs")

function hasContent(str) {
    return typeof str == "string" && str.length > 0
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

function productExists(req, res, next) {
    const id = parseInt(req.params.id)
    const data = JSON.parse(fs.readFileSync("./products.json", "utf8"))
    const product = data.products.find(p => p.id === id)

    if (!product) {
        return res.status(404).json({ message: "Product not found" })
    }

    req.data = data
    next()
}

function validateProduct(req, res, next) {
    const { name, category, price } = req.body

    if (!name || !category || price == null) {
        return res.status(400).json({ message: "Invalid product data" })
    }

    next()
}

app.get("/products", (req, res) => {
    const { search, category, subcategory } = req.query
    let { products } = JSON.parse(fs.readFileSync("./products.json", { encoding: "utf-8" }))

    if (hasContent(category)) {
        products = products.filter(p => p.category.toLowerCase() === category.toLowerCase())
    }

    if (hasContent(subcategory)) {
        products = products.filter(p => p.subcategory.toLowerCase() === subcategory.toLowerCase())
    }

    if (hasContent(search)) {
        products = products.filter(p =>
            JSON.stringify(p).toLowerCase().includes(search.toLowerCase())
        )
    }

    res.json({
        count: products.length,
        products
    })
})

app.get("/products/:id", productExists, (req, res) => {
    res.json(req.product)
})

app.post("/products", validateProduct, (req, res) => {
    const data = JSON.parse(fs.readFileSync("./products.json", "utf8"))

    const newProduct = {
        id: Date.now(),
        name: req.body.name,
        category: req.body.category,
        price: req.body.price
    }

    data.products.push(newProduct)

    fs.writeFileSync("./products.json", JSON.stringify(data, null, 2))

    res.status(201).json(newProduct)
})

app.put("/products/:id", productExists, validateProduct, (req, res) => {
    const id = parseInt(req.params.id)
    const products = req.data.products
    const index = products.findIndex(p => p.id === id)

    products[index] = { ...products[index], ...req.body }
    req.data.count = products.length

    fs.writeFileSync("./products.json", JSON.stringify(req.data, null, 2))

    res.status(200).json({
        message: "Product updated successfully",
        product: products[index]
    })
})

app.delete("/products/:id", productExists, (req, res) => {
    const id = parseInt(req.params.id)
    const products = req.data.products

    const newList = products.filter(p => p.id !== id)
    req.data.products = newList

    fs.writeFileSync("./products.json", JSON.stringify(req.data, null, 2))

    res.status(204).send()
})

app.listen(9000, () => console.log("Server running on port 9000"))

//https://github.com/Rubio412/ServerPost.git
