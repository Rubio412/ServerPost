const express = require("express")
const app = express()
const fs = require("fs")

function hasContent(str) {
    return typeof str == 'string' && str.length > 0
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get("/products", (req, res) => {
    const { search, category, subcategory } = req.query
    let { count, products } = JSON.parse(fs.readFileSync("./products.json", { encoding: "utf-8" }))
    
    if (hasContent(category)) {
        products = products.filter(product => product.category.toLowerCase() == category.toLowerCase())
    }

    if (hasContent(subcategory)) {
        products = products.filter(product => product.subcategory.toLowerCase() == subcategory.toLowerCase())
    }

    if (hasContent(search)) {
        products = products.filter(product => {
            const strProduct = JSON.stringify(product).toLowerCase()
            const lowerSearch = search.toLowerCase()
            return strProduct.includes(lowerSearch)
        })
    }

    res.json({
        count: products.length,
        products
    })
})

app.post("/products", (req, res) => {
    const { name, category, subcategory, price, currency, stock, rating } = req.body

    const newProduct = {
        name,
        category,
        subcategory,
        price,
        currency,
        stock,
        rating
    }

    const data = JSON.parse(fs.readFileSync("./products.json", { encoding: "utf-8" }))

    data.products.push(newProduct)
    data.count = data.products.length

    fs.writeFileSync("./products.json", JSON.stringify(data, null, 2))

    res.status(201).json({
        message: "Product created successfully",
        product: newProduct
    })
})

app.put("/products/:id", (req, res) => {
    const id = parseInt(req.params.id)
    const updatedData = req.body

    const data = JSON.parse(fs.readFileSync("./products.json", { encoding: "utf-8" }))
    const products = data.products

    const index = products.findIndex(p => p.id === id)

    if (index === -1) {
        return res.status(404).json({ message: "Product not found" })
    }

    products[index] = { ...products[index], ...updatedData }

    data.count = products.length

    fs.writeFileSync("./products.json", JSON.stringify(data, null, 2))

    res.status(200).json({
        message: "Product updated successfully",
        product: products[index]
    })
})

app.listen(9000, () => console.log("Server running on port 9000"))

//https://github.com/Rubio412/ServerPost.git
