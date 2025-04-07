/* ==================================================
   Premium E-Commerce Store JavaScript (Rewritten & Corrected)
   Designed & Developed by: Atharva Zope ✨
   Version: 3.1 - Enhanced Robustness
   ================================================== */

// ===== 0. Strict Mode & DOMContentLoaded Wrapper =====
'use strict';

document.addEventListener('DOMContentLoaded', () => {

    // ===== 1. Global Configuration & Variables =====
    const config = {
        debugMode: true, // SET TO true FOR DETAILED LOGS, false for production
        toastDuration: 3500,
        debounceDelay: 400,
        searchSuggestionLimit: 5,
        relatedProductsLimit: 4, // Used on home page trending & product details related
        mockApiDelay: 150, // Simulate network delay
        currencySymbol: '₹',
        locale: 'en-IN',
        taxRate: 0.18,
        shippingCost: 60,
        freeShippingThreshold: 999,
    };

    // State Variables
    let toastTimeout;
    let mockProducts = [];
    let mockCategories = [];
    let currentFilters = {}; // For products page
    let currentProduct = null; // For product details page
    let cart = [];
    let wishlist = [];
    let mockUser = null; // Simulate logged-in user state
    let appliedPromoCode = null;

    // ===== 2. Logging Helpers =====
    const log = (...args) => { if (config.debugMode) console.log('[PremiumStore LOG]', ...args); };
    const warn = (...args) => { console.warn('[PremiumStore WARN]', ...args); }; // Always show warnings
    const err = (...args) => { console.error('[PremiumStore ERROR]', ...args); }; // Always show errors

    log("Initializing PremiumStore JS v3.1...");

    // ===== 3. DOM Element Selectors (Cached where safe, checked otherwise) =====
    // Only select elements guaranteed to be on *every* page globally
    const body = document.body;
    const loaderOverlay = document.getElementById('loader-overlay');
    // Other elements will be selected within their specific init functions or checked before use

    // ===== 4. Utility Functions =====
    const formatPrice = (price) => {
        try {
            if (typeof price !== 'number' || isNaN(price)) {
                // warn("Invalid price for formatting:", price);
                return `${config.currencySymbol}-.--`;
            }
            return new Intl.NumberFormat(config.locale, {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(price);
        } catch (e) {
            err("formatPrice error:", e, "Input:", price);
            return `${config.currencySymbol}ERR`;
        }
    };

    const getFromLS = (key) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            err(`LocalStorage GET Error (${key}):`, e);
            try { localStorage.removeItem(key); } catch (removeErr) { /* Ignore */ }
            return null;
        }
    };

    const saveToLS = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            err(`LocalStorage SET Error (${key}):`, e);
            showToast("Could not save preferences. Storage might be full.", 5000);
        }
    };

    const getFromSS = (key) => {
        try {
            const item = sessionStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            err(`SessionStorage GET Error (${key}):`, e);
            try { sessionStorage.removeItem(key); } catch (removeErr) { /* Ignore */ }
            return null;
        }
    };

    const saveToSS = (key, value) => {
        try {
            sessionStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            err(`SessionStorage SET Error (${key}):`, e);
        }
    };

    const removeFromSS = (key) => {
        try {
            sessionStorage.removeItem(key);
        } catch (e) {
            err(`SessionStorage REMOVE Error (${key}):`, e);
        }
    };

    const showToast = (message, duration = config.toastDuration) => {
        const toastNotification = document.getElementById('toast-notification');
        const toastMessage = document.getElementById('toast-message');
        if (!toastNotification || !toastMessage) {
            warn("Toast elements not found, cannot show:", message);
            return;
        }
        try {
            toastMessage.textContent = message;
            toastNotification.classList.remove('show');
            void toastNotification.offsetWidth; // Trigger reflow
            toastNotification.classList.add('show');

            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                toastNotification.classList.remove('show');
            }, duration);
        } catch (e) {
            err("showToast error:", e);
        }
    };

    const findProductById = (id) => {
        try {
            const productId = parseInt(id);
            if (isNaN(productId)) {
                // warn("Invalid product ID provided:", id);
                return null;
            }
            return mockProducts.find(p => p && p.id === productId) || null;
        } catch (e) {
            err("findProductById error:", e, "ID:", id);
            return null;
        }
    };

    const setLoadingState = (button, isLoading, loadingText = "Processing...") => {
        if (!button || typeof button.disabled === 'undefined') return; // Ensure it's a button-like element
        try {
            if (isLoading) {
                button.disabled = true;
                button.classList.add('loading');
                if (!button.dataset.originalContent) {
                    button.dataset.originalContent = button.innerHTML;
                }
                button.innerHTML = `<span class="spinner-inline"></span> ${sanitizeHTML(loadingText)}`;
            } else {
                button.disabled = false;
                button.classList.remove('loading');
                if (button.dataset.originalContent) {
                    button.innerHTML = button.dataset.originalContent;
                    delete button.dataset.originalContent;
                } else {
                    // Fallback if original content wasn't stored (remove spinner)
                    const spinner = button.querySelector('.spinner-inline');
                    if (spinner) spinner.remove();
                    // Ensure some text remains if needed
                    if (!button.textContent?.trim() && button.dataset.originalContent === undefined) {
                        button.textContent = button.title || 'Submit';
                    }
                 }
            }
        } catch (e) {
            err("setLoadingState error:", e);
            // Attempt reset on error
            try {
                button.disabled = false;
                button.classList.remove('loading');
                button.innerHTML = button.dataset.originalContent || button.title || "Error";
                if(button.dataset.originalContent) delete button.dataset.originalContent;
            } catch (resetError) { /* Ignore nested error */ }
        }
    };

    const optionsAreEqual = (opts1, opts2) => {
        if (opts1 === opts2) return true; // Handles both null/undefined or same object reference
        if (!opts1 || !opts2) return false;
        return opts1.size === opts2.size && opts1.color === opts2.color;
    };

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                try {
                    func.apply(this, args);
                } catch (e) {
                    err("Debounced function error:", e);
                }
            }, delay);
        };
    };

    const formatDate = (isoString) => {
        if (!isoString) return '';
        try {
            return new Date(isoString).toLocaleDateString(config.locale, {
                year: 'numeric', month: 'short', day: 'numeric',
            });
        } catch (e) {
            // err("formatDate error:", e); // Can be noisy
            return 'Invalid Date';
        }
    };

    const sanitizeHTML = (str) => {
         if (str === null || typeof str === 'undefined') return '';
         try {
             const temp = document.createElement('div');
             temp.textContent = String(str);
             return temp.innerHTML;
         } catch (e) {
             err("sanitizeHTML error:", e, "Input:", str);
             return 'Error';
         }
     };

    // ===== 5. Mock Data Generation =====
    const generateMockData = () => {
        log("Generating Mock Data...");
        try {
            // Define product names per category (as in original script)
            const productDataByCategory = { "Men's Clothing": ["Classic Denim Jacket", "Slim Fit Formal Shirt", "Graphic Print T-Shirt", "Cotton Polo Shirt", "Hooded Sweatshirt", "Chino Trousers", "Cargo Joggers", "Woolen Overcoat", "Linen Kurta", "Bomber Jacket", "Sports Shorts", "Ethnic Nehru Jacket", "Printed Casual Shirt", "Sleeveless Gym Tank", "Cotton Boxer Pack"], "Women's Clothing": ["A-Line Floral Dress", "High-Waist Jeans", "Ruffle Blouse", "Crop Top Set", "Ethnic Anarkali Kurta", "Winter Trench Coat", "Sports Leggings", "Lace Party Gown", "Tie-Dye Co-ord Set", "Silk Saree", "Denim Skirt", "Sleeveless Maxi Dress", "Velvet Blazer", "Chikankari Kurti", "Sequin Bodycon Dress"], "Electronics": ["Smart 4K LED TV", "Wireless Noise-Canceling Headphones", "Android Smartwatch", "Bluetooth Soundbar", "DSLR Camera (Canon 200D)", "iPad Air (5th Gen)", "MacBook Air M2", "Portable Bluetooth Speaker", "Fast Charging Power Bank (20,000mAh)", "Wireless Gaming Mouse", "Mechanical RGB Keyboard", "Alexa Smart Speaker", "Dual Port Wall Charger", "256GB Flash Drive", "Webcam with Mic"], "Smartphones & Tablets": ["iPhone 15 Pro", "Samsung Galaxy S24 Ultra", "OnePlus 12", "Xiaomi 13 Pro", "Google Pixel 8", "iPad Mini (6th Gen)", "Realme Pad X", "Lenovo Yoga Tablet", "Motorola Edge+", "Oppo Reno10", "Vivo V30 Pro", "iPhone SE (2024)", "Samsung Galaxy Tab S9", "OnePlus Pad", "Nokia G42 5G"], "Footwear": ["Nike Running Shoes", "Adidas White Sneakers", "Leather Loafers", "Hiking Boots", "Formal Oxford Shoes", "Canvas Slip-Ons", "Puma Training Shoes", "Transparent Block Heels", "Kolhapuri Sandals", "Ankle-Length Boots", "Flat Ballerinas", "Crocs Unisex Clogs", "Wedge Heels", "Sports Sandals", "Slippers with Arch Support"], "Home Appliances": ["LG Front Load Washing Machine", "Samsung 2-Ton AC", "Philips Air Fryer", "Prestige Induction Cooktop", "Havells Electric Kettle", "IFB Microwave Oven", "Bosch Dishwasher", "Dyson Cordless Vacuum", "Instant Water Heater", "Mixer Grinder (750W)", "Air Purifier", "Refrigerator (Double Door)", "Ceiling Fan with Remote", "Sandwich Toaster", "Smart Rice Cooker"], "Beauty & Grooming": ["Maybelline Foundation Kit", "Lakmé Lipstick Pack", "Nykaa Eyeshadow Palette", "Philips Beard Trimmer", "Braun Hair Straightener", "Nivea Men’s Grooming Kit", "L'Oréal Face Serum", "Mamaearth Face Wash", "Vega Nail Art Kit", "Gillette Razor Combo", "Fragrance Set (Unisex)", "Cetaphil Moisturizer", "Himalaya Anti-Hairfall Oil", "Face Roller + Gua Sha Set", "Bath & Body Works Candle"], "Accessories": ["Smart Wallet", "Ray-Ban Aviators", "Analog Luxury Watch", "Minimalist Bracelet Set", "Laptop Backpack", "Leather Sling Bag", "Fashion Choker", "Phone Grip Ring", "Belt Combo (2-Pack)", "Beanie Cap (Unisex)", "Travel Organizer", "RFID Passport Holder", "Statement Earrings", "Clip-on Ties", "Designer Brooch"], "Books": ["Atomic Habits by James Clear", "Ikigai by Francesc Miralles", "The Psychology of Money", "Wings of Fire by A.P.J Abdul Kalam", "Sapiens by Yuval Noah Harari", "Rich Dad Poor Dad", "The Subtle Art of Not Giving a F*ck", "Think and Grow Rich", "You Can Win", "The Alchemist by Paulo Coelho", "Zero to One by Peter Thiel", "Harry Potter Box Set", "1984 by George Orwell", "The Power of Now", "Do Epic Sh*t by Ankur Warikoo"], "Furniture": ["Modular Sofa Set", "Queen Size Bed with Storage", "Wall-Mounted Bookshelf", "Office Ergonomic Chair", "Foldable Study Table", "Coffee Table (Glass Top)", "Bean Bag XXL", "Bedside Nightstand", "Wooden Dining Set (4-Seater)", "Shoe Rack with Mirror", "TV Entertainment Unit", "Recliner Chair", "Space-Saving Wardrobe", "Wall-Mounted Folding Desk", "Kitchen Trolley Cart"], "Kids & Toys": ["LEGO Classic Building Set", "Remote Control Car", "Barbie Dreamhouse", "Wooden Puzzle Game", "Drawing Kit", "Magnetic Blocks Set", "Nerf Elite Blaster", "Play-Doh Activity Box", "Toy Kitchen Set", "Glow-in-the-Dark Stickers", "Educational Laptop Toy", "Soft Plush Animals", "Tricycle for Toddlers", "Doctor Play Set", "Alphabet Learning Mat"], "Sports & Fitness": ["Home Gym Kit", "Yoga Mat (Anti-Slip)", "Dumbbell Pair (5kg)", "Resistance Band Set", "Cricket Bat (English Willow)", "Bicycle Helmet", "Gym Duffle Bag", "Badminton Racket Set", "Protein Shaker Bottle", "Skipping Rope (Adjustable)", "Fitness Smart Band", "Pull-Up Bar for Door", "Football (FIFA Approved)", "Table Tennis Set", "Volleyball Net Kit"], "Kitchen & Dining": ["Ceramic Dinner Set (16 pcs)", "Non-Stick Cookware Set", "Spice Rack Organizer", "Steel Tiffin Box Set", "Airtight Storage Jars", "Vegetable Chopper", "Glass Water Bottles", "Bamboo Cutting Board", "Stainless Steel Kadai", "Copper Serving Bowls", "Ice Cream Scoop Set", "Reusable Silicone Lids", "Mini Electric Chopper", "Kitchen Apron Set", "Dessert Bowl Pack"], "Travel & Outdoors": ["Waterproof Travel Backpack", "20 Cabin Trolley", "Neck Pillow with Eye Mask", "Foldable Camping Tent", "Travel Size Toiletry Set", "Solar Charger Bank", "TSA Lock Set", "Portable Hammock", "Packing Cubes (Set of 6)", "Hiking Shoes", "Foldable Umbrella", "Reusable Water Bottle", "Compact Travel Blanket", "Trekking Pole Set", "Dry Bag (Kayaking/Boating)"], "Stationery & Art": ["40-Piece Sketch Pen Set", "Premium Spiral Notebook", "Acrylic Paint Set", "Watercolor Journal Pad", "Calligraphy Pen Kit", "Sticky Notes Combo", "Desk Organizer Tray", "Highlighter Marker Set", "Bullet Journal Pack", "Ruler, Compass & Geometry Kit", "Artist Canvas Boards", "Fine Tip Brush Set", "Refillable Gel Pens", "Clip File Folders", "Washi Tape Set (10 Rolls)"] };

            // Defensive check for data structure
            if (typeof productDataByCategory !== 'object' || Object.keys(productDataByCategory).length === 0) {
                throw new Error("productDataByCategory is missing or invalid.");
            }
            mockCategories = Object.keys(productDataByCategory);

            const productImages = ['./images/product-1.jpg', './images/product-2.jpg', './images/product-3.jpg', './images/product-4.jpg', './images/product-5.jpg', './images/product-6.jpg', './images/product-7.jpg', './images/product-8.jpg'];
            const defaultImage = './images/placeholder.png';
            const lorem = "Discover the premium quality and unique design of this product. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

            const generateProductImagePath = (index) => {
                if (!productImages || productImages.length === 0) return defaultImage;
                const hash = (index * 13 + 7) % productImages.length;
                return productImages[hash] || defaultImage;
            };

            const generatePrice = (category, productName) => {
                let basePrice = 500, multiplier = 1;
                const lowerName = productName?.toLowerCase() || '';
                if (lowerName.includes("pro") || lowerName.includes("ultra") || lowerName.includes("luxury") || lowerName.includes("macbook") || lowerName.includes("iphone 1")) multiplier = 3.5;
                else if (lowerName.includes("air") || lowerName.includes("galaxy s") || lowerName.includes("pixel")) multiplier = 2.5;
                else if (lowerName.includes("mini") || lowerName.includes("se") || lowerName.includes("lite") || lowerName.includes("pad x")) multiplier = 0.8;
                if (lowerName.includes("set") || lowerName.includes("kit") || lowerName.includes("pack") || lowerName.includes("combo")) multiplier *= 1.8;

                switch (category) {
                    case "Electronics": basePrice = 9000; break;
                    case "Smartphones & Tablets": basePrice = 20000; break;
                    case "Home Appliances": basePrice = 7000; break;
                    case "Furniture": basePrice = 5000; break;
                    case "Men's Clothing": case "Women's Clothing": basePrice = 800; break;
                    case "Footwear": basePrice = 1200; break;
                    case "Beauty & Grooming": basePrice = 400; break;
                    case "Accessories": basePrice = 500; break;
                    case "Books": basePrice = 300; break;
                    case "Kids & Toys": basePrice = 450; break;
                    case "Sports & Fitness": basePrice = 600; break;
                    case "Kitchen & Dining": basePrice = 550; break;
                    case "Travel & Outdoors": basePrice = 900; break;
                    case "Stationery & Art": basePrice = 200; break;
                }
                const randomFactor = Math.random() * 1.2 + 0.6;
                let price = basePrice * randomFactor * multiplier;

                if (category === "Smartphones & Tablets" || lowerName.includes("macbook")) price = Math.max(8000, Math.min(price, 190000));
                else if (category === "Electronics" || category === "Home Appliances") price = Math.max(500, Math.min(price, 150000));
                else if (category === "Furniture") price = Math.max(1000, Math.min(price, 50000));
                else price = Math.max(150, Math.min(price, 20000));

                return parseFloat(price.toFixed(0));
            };

            const generateSKU = (category, id) => `${String(category).substring(0, 3).toUpperCase()}${String(id).padStart(5, '0')}`;

            const generateTags = (category, name) => {
                const tags = [String(category).replace(/&/g, 'and')];
                try {
                    const lowerName = String(name).toLowerCase();
                    // ... (tag generation logic - seemed okay) ...
                    if (lowerName.includes('shirt') || lowerName.includes('blouse') || lowerName.includes('top')) tags.push('Topwear');
                    if (lowerName.includes('t-shirt') || lowerName.includes('casual')) tags.push('Casual');
                    if (lowerName.includes('jacket') || lowerName.includes('coat') || lowerName.includes('blazer')) tags.push('Outerwear');
                    if (lowerName.includes('dress') || lowerName.includes('gown') || lowerName.includes('kurti') || lowerName.includes('saree')) tags.push('Womenswear');
                    if (lowerName.includes('jeans') || lowerName.includes('trousers') || lowerName.includes('joggers') || lowerName.includes('leggings') || lowerName.includes('skirt')) tags.push('Bottomwear');
                    if (lowerName.includes('ethnic') || lowerName.includes('kurta') || lowerName.includes('saree') || lowerName.includes('nehru')) tags.push('Traditional Wear', 'Indian Wear');
                    if (lowerName.includes('smart') || lowerName.includes('digital') || lowerName.includes('led') || lowerName.includes('alexa')) tags.push('Tech', 'Gadget');
                    if (lowerName.includes('wireless')) tags.push('Wireless');
                    if (lowerName.includes('bluetooth')) tags.push('Bluetooth');
                    if (lowerName.includes('running') || lowerName.includes('training') || lowerName.includes('sports') || lowerName.includes('gym') || lowerName.includes('fitness') || lowerName.includes('yoga')) tags.push('Activewear', 'Sports');
                    if (lowerName.includes('leather')) tags.push('Leather Goods');
                    if (lowerName.includes('travel') || lowerName.includes('backpack')) tags.push('Travel Gear');
                    if (lowerName.includes('home') || lowerName.includes('decor')) tags.push('Home');
                    if (lowerName.includes('kitchen') || lowerName.includes('dining')) tags.push('Kitchen');
                    if (lowerName.includes('kids') || lowerName.includes('toy') || lowerName.includes('barbie') || lowerName.includes('lego')) tags.push('Kids');
                    if (lowerName.includes('art') || lowerName.includes('stationery') || lowerName.includes('book')) tags.push('Creative');
                } catch (e) { warn("Error generating tags for:", name, e); }
                return [...new Set(tags)];
            };

            const indianReviewers = ["Aarav Sharma", "Vivaan Patel", "Aditya Singh", "Vihaan Kumar", "Arjun Gupta", "Sai Reddy", "Reyansh Mishra", "Krishna Verma", "Ishaan Yadav", "Rudra Ali", "Diya Sharma", "Saanvi Patel", "Anya Singh", "Myra Kumar", "Aarohi Gupta", "Ananya Reddy", "Pari Mishra", "Ishani Verma", "Anika Yadav", "Navya Ali"];
            const reviewTexts = ["Excellent quality, exceeded my expectations! Value for money.", "Good product, works as described. Fast delivery from PremiumStore.", "Decent item, but the color was slightly different. Okay overall.", "Not what I expected, packaging was damaged. Returned it.", "Amazing! Highly recommended. Looks exactly like the picture.", "Super fast delivery, well packaged. Genuine product.", "Looks great, functions perfectly. Happy with the purchase.", "Very useful, makes daily tasks easier. Worth buying.", "Average quality for the price. Might not last long.", "Simply superb! Best purchase this year.", "Build quality is average, but features are good.", "Received in Mumbai quickly. Good service.", "Perfect fit and color! Loved it.", "Battery life could be better, but good otherwise."];

            let productIdCounter = 1;
            mockProducts = []; // Reset before populating

            mockCategories.forEach(category => {
                 // Ensure the category exists in the data object
                 if (!productDataByCategory[category] || !Array.isArray(productDataByCategory[category])) {
                    warn(`Category data missing or invalid for: ${category}`);
                    return; // Skip this category
                 }
                productDataByCategory[category].forEach((productName) => {
                    // Add try/catch around individual product creation
                    try {
                        const price = generatePrice(category, productName);
                        const hasSale = Math.random() > 0.8;
                        const oldPrice = hasSale ? parseFloat((price * (1 + Math.random() * 0.4 + 0.15)).toFixed(0)) : null;
                        const rating = parseFloat((Math.random() * 1.8 + 3.2).toFixed(1));
                        const reviewCount = Math.floor(Math.random() * 250 + 5);
                        const stock = Math.random() > 0.1 ? Math.floor(Math.random() * 80 + 5) : 0;
                        const hasVariants = ["Men's Clothing", "Women's Clothing", "Footwear"].includes(category) && Math.random() > 0.3;
                        const id = productIdCounter++;

                        // Generate reviews safely
                        let reviews = [];
                        try {
                            reviews = Array.from({ length: Math.min(reviewCount, 8) }, () => ({
                                reviewer: indianReviewers[Math.floor(Math.random() * indianReviewers.length)] || 'Anonymous',
                                rating: Math.min(5, Math.max(1, Math.round(rating + (Math.random() * 2.5 - 1.25)))),
                                text: reviewTexts[Math.floor(Math.random() * reviewTexts.length)] || 'No comment.',
                                date: new Date(Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
                            })).sort((a, b) => (b.rating - a.rating) || (new Date(b.date) - new Date(a.date)));
                        } catch (reviewError) {
                             warn(`Error generating reviews for product ID ${id}:`, reviewError);
                        }

                        // Generate Q&A safely
                        let questions = [];
                         try {
                            questions = [
                                { q: `Is Cash on Delivery (COD) available for this item in Pune?`, a: "Yes, COD is available for most locations in Pune for this item. Please check availability at checkout using your pincode.", date: "2024-05-10" },
                                ...(stock < 10 && stock > 0 ? [{ q: "Only few left! When will this be back in full stock?", a: "We expect a larger restock within the next 2-3 weeks. You can add it to your wishlist to be notified.", date: "2024-05-15" }] : []),
                                ...(hasVariants && Math.random() > 0.5 ? [{ q: `Is the ${productName} available in size XXL or color Orange?`, a: "Currently, this product is available in the sizes and colors listed on the page. We update our inventory regularly!", date: "2024-04-28" }] : [])
                            ];
                         } catch(qaError) {
                              warn(`Error generating Q&A for product ID ${id}:`, qaError);
                         }


                        mockProducts.push({
                            id: id,
                            sku: generateSKU(category, id),
                            name: productName,
                            category: category,
                            price: price,
                            oldPrice: oldPrice,
                            description: `Experience the best with the ${productName}. ${lorem.substring(0, Math.floor(Math.random() * 120 + 100))} Available now at PremiumStore with fast shipping across India.`,
                            images: Array.from(
                                { length: Math.floor(Math.random() * 3 + 2) },
                                (_, imgIndex) => generateProductImagePath(id * 3 + imgIndex)
                            ),
                            rating: rating,
                            reviewCount: reviewCount,
                            stock: stock,
                            tags: generateTags(category, productName),
                            weightKg: parseFloat((Math.random() * 2 + 0.1).toFixed(2)),
                            dimensionsCm: {
                                length: parseFloat((Math.random() * 30 + 5).toFixed(1)),
                                width: parseFloat((Math.random() * 20 + 5).toFixed(1)),
                                height: parseFloat((Math.random() * 10 + 2).toFixed(1)),
                            },
                            options: hasVariants ? {
                                sizes: ["S", "M", "L", "XL"].filter(() => Math.random() > 0.2),
                                colors: ["Red", "Blue", "Black", "White", "Grey", "Green", "Yellow", "Pink"].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 4 + 2))
                            } : null,
                            reviews: reviews,
                            questions: questions
                        });
                    } catch (genError) {
                        err(`Error generating product '${productName}' in category '${category}':`, genError);
                        // Continue to next product instead of crashing
                    }
                });
            });

            // --- Apply Deal of the Day Modifications (with safety checks) ---
            try {
                const dealProductName = "Android Smartwatch";
                let dealProductIndex = mockProducts.findIndex(p => p?.name === dealProductName);

                if (dealProductIndex > -1) {
                    const product = mockProducts[dealProductIndex];
                    mockProducts[dealProductIndex] = {
                        ...product,
                        price: 2499,
                        oldPrice: product.oldPrice || 4999, // Use existing or default
                        description: `Limited Time Deal! Get the feature-packed ${product.name || 'Android Smartwatch'} with health tracking, long battery life, and vibrant AMOLED display at an unbeatable price. Track your steps, heart rate, sleep, and more. Compatible with Android & iOS. Ends soon!`,
                        tags: [...(product.tags || []), "Deal of the Day", "Limited Time Offer", "Smartwatch", "Fitness Tracker"]
                    };
                } else {
                    warn(`Deal product '${dealProductName}' not found. Applying deal to first suitable electronic item.`);
                    const fallbackDealIndex = mockProducts.findIndex(p => p?.category === "Electronics" && p.rating >= 4.0 && p.stock > 0);
                    if (fallbackDealIndex > -1) {
                        const product = mockProducts[fallbackDealIndex];
                        product.oldPrice = product.price;
                        product.price = parseFloat((product.price * 0.7).toFixed(0));
                        product.tags = [...(product.tags || []), "Deal of the Day", "Special Offer"];
                        product.description = `Special Offer! ${product.description}`;
                    } else {
                        warn("No suitable fallback product found for Deal of the Day.");
                    }
                }
            } catch (dealError) {
                 err("Error applying Deal of the Day logic:", dealError);
            }
            // --- End Deal of the Day ---

            log(`Mock Data Generated: ${mockProducts.length} products across ${mockCategories.length} categories.`);

        } catch (error) {
            err("FATAL: Error during Mock Data Generation:", error);
            mockProducts = []; // Ensure it's empty on error
            mockCategories = [];
            showToast("Error loading product data. Please refresh.", 10000);
        }
    };

    // ===== 6. State Initialization =====
    const loadInitialState = () => {
        try {
            log("Loading initial state...");

            const storedCart = getFromLS('cart');
            cart = Array.isArray(storedCart) ? storedCart : [];

            const storedWishlist = getFromLS('wishlist');
            wishlist = Array.isArray(storedWishlist) ? storedWishlist : [];

            const storedTheme = getFromLS('theme');
            applyTheme(storedTheme === 'dark' ? 'dark' : 'light', false); // Apply theme without saving again

            mockUser = getFromSS('currentUser');
            appliedPromoCode = getFromSS('appliedPromo');

            log("Initial State Loaded - Cart:", cart.length, "Wishlist:", wishlist.length, "Theme:", body.classList.contains('dark-mode') ? 'dark' : 'light', "User:", mockUser?.name || 'None', "Promo:", appliedPromoCode?.code || 'None');

        } catch (error) {
            err("Error loading initial state from storage:", error);
            cart = []; wishlist = []; applyTheme('light', false); mockUser = null; appliedPromoCode = null;
            try { localStorage.clear(); sessionStorage.clear(); } catch (clearError) {} // Attempt to clear storage
            showToast("Error loading saved data. Resetting state.", 5000);
        }
    };

    // ===== 7. Cart Management =====
    const updateCart = () => {
        try {
            saveToLS('cart', cart);
            updateCartIcon();
            document.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart: cart } }));
            log("Cart updated:", cart.map(item => ({ id: item.id, qty: item.quantity })));
        } catch (e) {
            err("updateCart error:", e);
        }
    };

    const addToCart = (productId, quantity = 1, options = {}, event = null) => {
        const button = event?.target?.closest('.add-to-cart-btn');
        if (button) setLoadingState(button, true);

        // Use setTimeout to simulate delay and prevent UI freeze
        setTimeout(() => {
            try {
                const product = findProductById(productId);
                if (!product) throw new Error("Product not found!");
                if (product.stock === 0) throw new Error(`Sorry, '${product.name}' is currently out of stock.`);

                const requestedQuantity = parseInt(quantity) || 1;
                if (requestedQuantity < 1) throw new Error("Quantity must be at least 1.");

                // Robust Option Handling
                const currentOptions = options || {};
                const requiredOptions = product.options || {};
                let missingOption = null;
                if (requiredOptions.sizes && requiredOptions.sizes.length > 0 && !currentOptions.size) missingOption = "size";
                else if (requiredOptions.colors && requiredOptions.colors.length > 0 && !currentOptions.color) missingOption = "color";

                const isOnDetailsPage = body.classList.contains('product-details-page');
                if (isOnDetailsPage && missingOption) {
                    throw new Error(`Please select a ${missingOption} for '${product.name}'.`);
                }
                // Ensure options object exists even if empty for comparison
                const finalOptions = (isOnDetailsPage || Object.keys(options).length > 0) ? currentOptions : {};

                const existingItemIndex = cart.findIndex(item =>
                    item.id === product.id && optionsAreEqual(item.options || {}, finalOptions)
                );

                let message = "";
                if (existingItemIndex > -1) {
                    const existingQuantity = cart[existingItemIndex].quantity || 0;
                    const newQuantity = existingQuantity + requestedQuantity;

                    if (product.stock < newQuantity) {
                        if (product.stock <= existingQuantity) {
                             throw new Error(`No more stock available for '${product.name}'. You already have the maximum (${existingQuantity}) in your cart.`);
                        }
                        cart[existingItemIndex].quantity = product.stock;
                        message = `Only ${product.stock - existingQuantity} more added. Max stock (${product.stock}) for '${product.name}' reached in cart.`;
                    } else {
                        cart[existingItemIndex].quantity = newQuantity;
                        message = `'${product.name}' quantity updated to ${newQuantity}!`;
                    }
                } else {
                    if (product.stock < requestedQuantity) {
                        throw new Error(`Only ${product.stock} of '${product.name}' available.`);
                    }
                    cart.push({
                        id: product.id,
                        quantity: requestedQuantity,
                        options: finalOptions,
                        price: product.price,
                        name: product.name,
                        image: product.images?.[0] || defaultImage
                    });
                    message = `'${product.name}' added to cart!`;
                }

                updateCart();
                showToast(message);

            } catch (error) {
                err("addToCart Error:", error);
                showToast(error.message || "Could not add item to cart.", 4000);
            } finally {
                if (button) setLoadingState(button, false);
            }
        }, config.mockApiDelay);
    };

    const removeFromCart = (productId) => {
        try {
            const pid = parseInt(productId);
            if (isNaN(pid)) return;

            const itemIndex = cart.findIndex(item => item?.id === pid);
            if (itemIndex === -1) return; // Item not found

            const removedItemName = cart[itemIndex]?.name || 'Item';
            cart = cart.filter((item, index) => index !== itemIndex); // Remove by index

            updateCart();
            showToast(`'${removedItemName}' removed from cart.`);
        } catch (e) {
            err("removeFromCart error:", e);
            showToast("Error removing item from cart.", 4000);
        }
    };

    const updateCartQuantity = (productId, newQuantity) => {
        try {
            const pid = parseInt(productId);
            const product = findProductById(pid); // Get fresh product info for stock
            if (isNaN(pid) || !product) return;

            const itemIndex = cart.findIndex(item => item?.id === pid);
            if (itemIndex > -1) {
                let updatedQuantity = parseInt(newQuantity);
                if (isNaN(updatedQuantity) || updatedQuantity < 0) { // Handle invalid input
                     updatedQuantity = cart[itemIndex].quantity; // Keep current if invalid
                }

                // Check against stock AFTER validating input
                if (updatedQuantity > product.stock) {
                    showToast(`Only ${product.stock} of '${product.name}' in stock.`);
                    updatedQuantity = product.stock;
                }

                if (updatedQuantity === 0) {
                    // If quantity becomes 0, remove the item
                    removeFromCart(pid);
                } else {
                    cart[itemIndex].quantity = updatedQuantity;
                    updateCart(); // Save changes and update UI
                    // Re-render cart only if on cart page to reflect price changes
                    if (getCurrentPage() === 'cart') {
                         renderCart(); // Re-render to update line item total and summary
                    }
                }
            }
        } catch (e) {
            err("updateCartQuantity error:", e);
            showToast("Error updating cart quantity.", 4000);
        }
    };


    const calculateCartTotals = (promo = appliedPromoCode) => {
        try {
            const subtotal = cart.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 0)), 0);

            let discount = 0;
            let shipping = (subtotal > config.freeShippingThreshold || subtotal === 0) ? 0 : config.shippingCost;
            let promoMessage = "";

            if (promo && subtotal > 0) {
                const code = promo.code || '';
                const type = promo.type || '';
                const value = promo.value || 0;
                log("Applying promo:", code, type, value);

                if (type === 'percentage' && value > 0) {
                    discount = subtotal * value;
                    promoMessage = `Promo '${code}' (${(value * 100).toFixed(0)}%) applied`;
                } else if (type === 'fixed' && value > 0) {
                    discount = Math.min(subtotal, value);
                    promoMessage = `Promo '${code}' (${formatPrice(value)} off) applied`;
                } else if (type === 'free_shipping') {
                    shipping = 0;
                    promoMessage = `Promo '${code}' (Free Shipping) applied`;
                } else {
                    warn("Invalid promo type or value:", promo);
                }
                discount = Math.max(0, discount);
                log("Calculated Discount:", discount, "Shipping:", shipping);
            }

            const discountedSubtotal = Math.max(0, subtotal - discount);
            const tax = discountedSubtotal * config.taxRate;
            const total = discountedSubtotal + shipping + tax;

            return { subtotal, shipping, tax, total, discount, promoCode: promo ? promo.code : null, promoMessage };
        } catch (e) {
            err("calculateCartTotals error:", e);
            return { subtotal: 0, shipping: config.shippingCost, tax: 0, total: config.shippingCost, discount: 0, promoCode: null, promoMessage: "Error calculating totals" };
        }
    };

    const updateCartIcon = () => {
        const cartIconBtn = document.getElementById('cart-icon-btn');
        const cartCountSpan = document.getElementById('cart-count');
        if (!cartCountSpan) return;
        try {
            const totalItems = cart.reduce((sum, item) => sum + (item?.quantity || 0), 0);
            cartCountSpan.textContent = totalItems;
            cartCountSpan.style.display = totalItems > 0 ? 'flex' : 'none';

            if (cartIconBtn && totalItems > 0 && !cartIconBtn.classList.contains('updated')) {
                 cartIconBtn.classList.add('updated');
                 setTimeout(() => cartIconBtn?.classList.remove('updated'), 300);
            }
        } catch (e) {
            err("updateCartIcon error:", e);
            cartCountSpan.style.display = 'none'; // Hide on error
        }
    };

    // ===== 8. Wishlist Management =====
    const updateWishlist = () => {
        try {
            saveToLS('wishlist', wishlist);
            updateWishlistHeaderIconState();
            document.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: { wishlist: wishlist } }));
            log("Wishlist updated:", wishlist);
        } catch (e) {
            err("updateWishlist error:", e);
        }
    };

    const addToWishlist = (productId) => {
        try {
            const pid = parseInt(productId);
            if (isNaN(pid)) return;

            if (!wishlist.includes(pid)) {
                wishlist.push(pid);
                updateWishlist();
                const product = findProductById(pid);
                showToast(`'${product?.name || 'Item'}' added to wishlist!`);
                updateWishlistButtonState(pid, true);
            }
        } catch (e) {
            err("addToWishlist error:", e);
            showToast("Error adding to wishlist.", 4000);
        }
    };

    const removeFromWishlist = (productId) => {
        try {
            const pid = parseInt(productId);
            if (isNaN(pid)) return;

            const initialLength = wishlist.length;
            wishlist = wishlist.filter(id => id !== pid);

            if (wishlist.length < initialLength) {
                updateWishlist();
                 const product = findProductById(pid); // Get name for message
                showToast(`'${product?.name || 'Item'}' removed from wishlist.`);
                updateWishlistButtonState(pid, false);
            }
        } catch (e) {
            err("removeFromWishlist error:", e);
            showToast("Error removing from wishlist.", 4000);
        }
    };

    const toggleWishlist = (productId) => {
        try {
            const pid = parseInt(productId);
            if (isNaN(pid)) return;
            if (wishlist.includes(pid)) removeFromWishlist(pid);
            else addToWishlist(pid);
        } catch (e) {
            err("toggleWishlist error:", e);
            showToast("Error updating wishlist.", 4000);
        }
    };

    const isInWishlist = (productId) => {
        try {
            const pid = parseInt(productId);
            return !isNaN(pid) && wishlist.includes(pid);
        } catch { return false; }
    };

    const updateWishlistButtonState = (productId, isWishlisted) => {
        try {
            // Define SVGs centrally or ensure they are correct
            const iconFilled = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18px" height="18px"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
            const iconOutline = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18px" height="18px"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>`;

            const buttons = document.querySelectorAll(`.add-to-wishlist-btn[data-product-id="${productId}"], .add-to-wishlist-quick[data-product-id="${productId}"]`);
            buttons.forEach(button => {
                if (button) {
                    button.classList.toggle('active', isWishlisted);
                    button.title = isWishlisted ? "In Wishlist" : "Add to Wishlist";
                    button.innerHTML = isWishlisted ? iconFilled : iconOutline;
                }
            });
        } catch (e) {
            err("updateWishlistButtonState error for ID", productId, e);
        }
    };

    const updateWishlistHeaderIconState = () => {
        const wishlistIconLink = document.getElementById('wishlist-icon-link');
        if (!wishlistIconLink) return;
        try {
            wishlistIconLink.classList.toggle('has-items', wishlist.length > 0);
            wishlistIconLink.title = wishlist.length > 0 ? `Wishlist (${wishlist.length} items)` : "Wishlist";
        } catch (e) {
            err("updateWishlistHeaderIconState error:", e);
        }
    };

    // ===== 9. Promo Code Management =====
    const mockPromoCodes = {
        "SAVE10": { type: 'percentage', value: 0.10, description: "10% off your order" },
        "PREMIUM200": { type: 'fixed', value: 200, description: `₹200 off your order` },
        "FREESHIP": { type: 'free_shipping', value: 0, description: "Free Shipping on your order" }
    };

    const applyPromoCode = (code) => {
        try {
            const normalizedCode = String(code || '').toUpperCase().trim();
            if (!normalizedCode) {
                 showToast("Please enter a promo code.");
                 return;
            }
            const promo = mockPromoCodes[normalizedCode];

            if (promo) {
                appliedPromoCode = { code: normalizedCode, ...promo };
                saveToSS('appliedPromo', appliedPromoCode);
                showToast(`Promo code '${normalizedCode}' applied! ${promo.description}.`);
                document.dispatchEvent(new CustomEvent('promoApplied', { detail: { promo: appliedPromoCode } }));
                log("Promo code applied:", appliedPromoCode);
            } else {
                if (appliedPromoCode) removePromoCode(); // Clear existing if applying invalid
                showToast("Invalid promo code.");
            }
        } catch (e) {
            err("applyPromoCode error:", e);
            showToast("Error applying promo code.", 4000);
        }
    };

    const removePromoCode = () => {
        try {
            if (appliedPromoCode) {
                const removedCode = appliedPromoCode.code;
                appliedPromoCode = null;
                removeFromSS('appliedPromo');
                showToast(`Promo code '${removedCode}' removed.`);
                document.dispatchEvent(new CustomEvent('promoApplied', { detail: { promo: null } }));
                log("Promo code removed.");
            }
        } catch (e) {
            err("removePromoCode error:", e);
            showToast("Error removing promo code.", 4000);
        }
    };

    // ===== 10. Theme Management =====
    const applyTheme = (theme, save = true) => {
        try {
            body.classList.remove('light-mode', 'dark-mode');
            const newTheme = (theme === 'dark') ? 'dark' : 'light';
            body.classList.add(newTheme + '-mode');

            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) {
                themeToggle.setAttribute('aria-pressed', newTheme === 'dark');
                // Ensure icons update correctly based on the applied theme class
                const sunIcon = themeToggle.querySelector('.sun-icon');
                const moonIcon = themeToggle.querySelector('.moon-icon');
                if (sunIcon) sunIcon.style.opacity = newTheme === 'light' ? '1' : '0';
                if (moonIcon) moonIcon.style.opacity = newTheme === 'dark' ? '1' : '0';
            }

            if (save) {
                saveToLS('theme', newTheme);
            }
            log("Theme applied:", newTheme);
        } catch (e) {
            err("applyTheme error:", e);
        }
    };

    const toggleTheme = () => {
        try {
            const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark'); // Apply and save
        } catch (e) {
            err("toggleTheme error:", e);
        }
    };

    // ===== 11. UI Component Initialization =====

    const hideLoader = () => {
        if (!loaderOverlay) return;
        try {
            loaderOverlay.classList.add('hidden');
            const handleTransitionEnd = () => {
                 if (loaderOverlay) {
                      loaderOverlay.style.display = 'none';
                      loaderOverlay.removeEventListener('transitionend', handleTransitionEnd);
                 }
            };
            loaderOverlay.addEventListener('transitionend', handleTransitionEnd);
            // Fallback timer
            setTimeout(() => {
                if(loaderOverlay && loaderOverlay.classList.contains('hidden') && loaderOverlay.style.display !== 'none') {
                     loaderOverlay.style.display = 'none';
                     log("Loader hidden via fallback timer.");
                }
            }, 600); // Should match CSS transition duration
        } catch (e) {
            err("hideLoader error:", e);
            if (loaderOverlay) loaderOverlay.style.display = 'none';
        }
    };

    const initScrollToTop = () => {
        const scrollToTopBtn = document.getElementById('scrollToTopBtn');
        if (!scrollToTopBtn) return;
        try {
            const scrollHandler = debounce(() => {
                 // Check element again inside handler in case it was removed
                const btn = document.getElementById('scrollToTopBtn');
                if (btn) {
                    btn.classList.toggle('visible', window.scrollY > 300);
                }
            }, 150); // Slightly longer debounce for scroll

            const clickHandler = () => window.scrollTo({ top: 0, behavior: 'smooth' });

            window.addEventListener('scroll', scrollHandler, { passive: true });
            scrollToTopBtn.addEventListener('click', clickHandler);
        } catch (e) {
            err("initScrollToTop error:", e);
        }
    };

    const initMobileNav = () => {
        const hamburgerMenu = document.getElementById('hamburger-menu');
        const navLinks = document.getElementById('nav-links');
        const navOverlay = document.getElementById('nav-overlay'); // Ensure this ID exists in HTML if used
        if (!hamburgerMenu || !navLinks) return;

        try {
            const toggleMenu = (forceClose = false) => {
                 const isActive = navLinks.classList.contains('active');
                 if (forceClose || isActive) {
                     navLinks.classList.remove('active');
                     hamburgerMenu.classList.remove('active');
                     hamburgerMenu.setAttribute('aria-expanded', 'false');
                     if (navOverlay) navOverlay.classList.remove('active');
                     body.style.overflow = '';
                 } else {
                     navLinks.classList.add('active');
                     hamburgerMenu.classList.add('active');
                     hamburgerMenu.setAttribute('aria-expanded', 'true');
                     if (navOverlay) navOverlay.classList.add('active');
                     body.style.overflow = 'hidden';
                 }
            };

            hamburgerMenu.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
            if (navOverlay) navOverlay.addEventListener('click', () => toggleMenu(true));
            navLinks.addEventListener('click', (e) => { if (e.target.tagName === 'A') toggleMenu(true); });
            document.addEventListener('keydown', (e) => { if (e.key === "Escape" && navLinks.classList.contains('active')) toggleMenu(true); });

        } catch (e) {
            err("initMobileNav error:", e);
        }
    };

    const initSearchBar = () => {
        const searchIconBtn = document.getElementById('search-icon-btn');
        const searchBarContainer = document.getElementById('search-bar-container');
        const searchInputDropdown = document.getElementById('search-input-dropdown');
        const searchResultsContainer = document.getElementById('search-results-dropdown'); // Ensure this ID exists in HTML

        if (!searchIconBtn || !searchBarContainer || !searchInputDropdown) {
             warn("Search bar elements missing, disabling search functionality.");
             if(searchIconBtn) searchIconBtn.style.display = 'none';
             return;
        }

        try {
            const showSuggestions = (results) => {
                if (!searchResultsContainer) return;
                searchResultsContainer.innerHTML = '';
                if (results.length === 0) {
                    searchResultsContainer.style.display = 'none'; return;
                }

                const list = document.createElement('ul');
                results.slice(0, config.searchSuggestionLimit).forEach(product => {
                     if (!product || !product.id) return; // Skip invalid results
                    const li = document.createElement('li');
                    try {
                        const imageSrc = product.images?.[0] || defaultImage;
                        li.innerHTML = `
                            <a href="product-details.html#${product.id}" data-product-id="${product.id}">
                                <img src="${imageSrc}" alt="" width="35" height="35" loading="lazy" onerror="this.style.display='none'">
                                <span>${sanitizeHTML(product.name)}</span>
                                <span class="price">${formatPrice(product.price)}</span>
                            </a>`;
                    } catch (renderErr) {
                        err("Error rendering search suggestion:", renderErr);
                        li.innerHTML = `<a>Error displaying item</a>`;
                    }
                    list.appendChild(li);
                });
                searchResultsContainer.appendChild(list);
                searchResultsContainer.style.display = 'block';
            };

            const handleSearchInput = debounce(() => {
                try {
                    const searchTerm = searchInputDropdown.value.toLowerCase().trim();
                    if (searchTerm.length < 2) {
                        if (searchResultsContainer) searchResultsContainer.style.display = 'none'; return;
                    }
                    const results = mockProducts.filter(p => p && (
                        (p.name && p.name.toLowerCase().includes(searchTerm)) ||
                        (p.category && p.category.toLowerCase().includes(searchTerm)) ||
                        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
                    ));
                    showSuggestions(results);
                } catch (searchErr) {
                    err("Error handling search input:", searchErr);
                    if (searchResultsContainer) searchResultsContainer.style.display = 'none';
                }
            }, config.debounceDelay);

            searchInputDropdown.addEventListener('input', handleSearchInput);
            searchIconBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isActive = searchBarContainer.classList.toggle('active');
                if (isActive) searchInputDropdown.focus();
                else if (searchResultsContainer) searchResultsContainer.style.display = 'none';
            });

            document.addEventListener('click', (e) => {
                if (searchBarContainer.classList.contains('active') &&
                    !searchBarContainer.contains(e.target) && e.target !== searchIconBtn) {
                    searchBarContainer.classList.remove('active');
                    if (searchResultsContainer) searchResultsContainer.style.display = 'none';
                }
            });

            if (searchResultsContainer) {
                 searchResultsContainer.addEventListener('click', e => {
                      const link = e.target.closest('a[data-product-id]');
                      if (link) {
                           const productId = link.dataset.productId;
                           saveToSS('selectedProductId', productId);
                           searchBarContainer.classList.remove('active');
                           searchResultsContainer.style.display = 'none';
                           // Allow navigation
                      }
                      e.stopPropagation();
                 });
             }

        } catch (e) {
            err("initSearchBar error:", e);
        }
    };

    const setActiveNavLink = () => {
        const navLinks = document.getElementById('nav-links');
        if (!navLinks) return;
        try {
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            navLinks.querySelectorAll('a').forEach(link => {
                 if (!link || !link.getAttribute('href')) return;
                const linkPage = link.getAttribute('href').split('/').pop().split('#')[0] || 'index.html';
                let isActive = (linkPage === currentPage);
                // Handle special cases like product details highlighting products link
                if (currentPage === 'product-details.html' && linkPage === 'products.html') isActive = true;
                if ((currentPage === '' || currentPage === 'index.html') && (linkPage === '' || linkPage === 'index.html')) isActive = true;

                link.classList.toggle('active', isActive);
            });
        } catch (e) {
            err("setActiveNavLink error:", e);
        }
    };

    const loadIcons = () => {
        log("Loading icons...");
        try {
            const iconMap = {
                'search-icon-btn': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px"><path d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5 1.49-1.49-5-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
                'wishlist-icon-link': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20px" height="20px"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>`,
                'cart-icon-btn': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20px" height="20px"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>`,
                'theme-toggle': `<span class="sun-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14px" height="14px"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.64 5.64c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41L5.64 5.64zm12.73 12.73c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.06-1.06zM18.36 5.64c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.02 0 1.41s1.02.39 1.41 0l1.06-1.06zm-12.73 12.73c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.02 0 1.41s1.02.39 1.41 0l1.06-1.06z"/></svg></span><span class="moon-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14px" height="14px"><path d="M9.37 2.69C4.63 4.2 1 8.65 1 14c0 4.41 3.59 8 8 8 5.35 0 9.8-3.63 11.31-8.37-.42 1.11-1.05 2.1-1.88 2.93-1.81 1.81-4.27 2.83-6.87 2.83-5.52 0-9.99-4.47-9.99-9.99 0-2.6.99-5.02 2.82-6.85.8-.8 1.75-1.44 2.83-1.87z"/></svg></span>`,
                'hamburger-menu': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>`,
                'scrollToTopBtn': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`,
                'contact-person': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
                'contact-phone': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`,
                'contact-email': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/></svg>`,
                'contact-address': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
                'contact-hours': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
                'remove-item-btn': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18px" height="18px"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>` // Cart/Wishlist remove
            };

            for (const id in iconMap) {
                const el = document.getElementById(id);
                // Check if element exists and has placeholder content OR is the theme toggle
                 if (el && (id === 'theme-toggle' || el.innerHTML.trim().length < 5 || /^[🔍❤️🛒🌙☰▲👤📞📧📍⏰🗑️]$/.test(el.textContent.trim()))) {
                    try {
                        el.innerHTML = iconMap[id];
                         // Special handling for cart count span if it gets overwritten
                        if (id === 'cart-icon-btn') {
                            const cartCountSpan = document.getElementById('cart-count');
                            if (cartCountSpan && !el.contains(cartCountSpan)) {
                                 el.appendChild(cartCountSpan);
                            }
                            updateCartIcon(); // Ensure count is correct
                        }
                    } catch (e) {
                        err("Error setting icon HTML for", id, e);
                        if(el) el.textContent = '?';
                    }
                } else if (el && el.tagName === 'A') { // Links like wishlist/cart
                     if(el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE && /^[❤️🛒]$/.test(el.firstChild.textContent.trim())) {
                          try {
                             const originalChildren = Array.from(el.childNodes); // Store original children (like cart count span)
                             el.innerHTML = iconMap[id]; // Set the SVG
                             originalChildren.forEach(child => { // Re-append other children
                                  if (child.nodeType !== Node.TEXT_NODE || !/^[❤️🛒]$/.test(child.textContent.trim())) {
                                       el.appendChild(child);
                                  }
                             });
                             if (id === 'cart-icon-btn') updateCartIcon();
                             if (id === 'wishlist-icon-link') updateWishlistHeaderIconState();
                         } catch (e) {
                             err("Error setting icon HTML for link", id, e);
                             el.textContent = '?';
                         }
                     }
                } else if (!el && config.debugMode) {
                    // Only warn if debug mode is on, as some icons might not be on every page
                    warn(`Icon element with ID '${id}' not found.`);
                }
            }
            // Re-apply theme icons state after loading SVGs
            applyTheme(body.classList.contains('dark-mode') ? 'dark' : 'light', false);
            // Re-update all wishlist button states on the page
             updateAllWishlistButtonStates();

        } catch (e) {
            err("loadIcons error:", e);
        }
    };

    const setFooterYear = () => {
        const yearSpan = document.getElementById('current-year');
        if (yearSpan) yearSpan.textContent = new Date().getFullYear();
        else warn("Footer year span not found.");
    };

    // ===== 12. Product Rendering & Grid Handling =====
    const renderStars = (rating) => {
        try {
            if (typeof rating !== 'number' || isNaN(rating) || rating < 0 || rating > 5) return '';
            const fullStars = Math.floor(rating);
            const halfStar = rating % 1 >= 0.4 && rating % 1 < 0.9;
            const fullStarThreshold = rating % 1 >= 0.9;
            const actualFullStars = fullStars + (fullStarThreshold ? 1 : 0);
            const useHalfStar = halfStar && !fullStarThreshold;
            const emptyStars = 5 - actualFullStars - (useHalfStar ? 1 : 0);

            const starFull = '⭐'; // Or SVG
            const starHalf = '🌗'; // Or SVG
            const starEmpty = '☆'; // Or SVG

            return starFull.repeat(actualFullStars) + (useHalfStar ? starHalf : '') + starEmpty.repeat(emptyStars);
        } catch (e) {
            err("renderStars error:", e);
            return '☆☆☆☆☆';
        }
    };

    const renderProductCard = (product) => {
        // Moved check to the caller (renderProductGrid, renderWishlist, etc.)
        if (!product || typeof product.id === 'undefined') {
             warn("renderProductCard called with invalid product:", product);
             return null;
        }

        try {
            const card = document.createElement('div');
            card.className = 'product-card fade-in';
            card.dataset.productId = product.id;

            const isWishlisted = isInWishlist(product.id);
            const wishlistedIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18px" height="18px"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
            const notWishlistedIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18px" height="18px"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>`;
            const imageSrc = product.images?.[0] || defaultImage;
            const stock = product.stock ?? 0; // Handle potentially missing stock

            card.innerHTML = `
                <div class="product-image">
                    <a href="product-details.html#${product.id}" data-product-id="${product.id}">
                        <img src="${imageSrc}" alt="${sanitizeHTML(product.name || 'Product Image')}" loading="lazy" onerror="this.onerror=null;this.src='${defaultImage}'; this.alt='Image failed to load';">
                    </a>
                    <div class="quick-actions">
                        <button class="add-to-wishlist-quick ${isWishlisted ? 'active' : ''}" data-product-id="${product.id}" title="${isWishlisted ? 'In Wishlist' : 'Add to Wishlist'}" aria-label="${isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}">
                            ${isWishlisted ? wishlistedIcon : notWishlistedIcon}
                        </button>
                    </div>
                     ${stock === 0 ? '<span class="out-of-stock-badge">Out of Stock</span>' : ''}
                </div>
                <div class="product-info-card">
                    <h3><a href="product-details.html#${product.id}" data-product-id="${product.id}">${sanitizeHTML(product.name || 'Product Name')}</a></h3>
                    ${product.rating ? `
                        <div class="star-rating" title="${product.rating.toFixed(1)} stars (${product.reviewCount || 0} reviews)">
                            ${renderStars(product.rating)}
                            ${product.reviewCount ? `<span class="review-count">(${product.reviewCount})</span>` : ''}
                        </div>` : '<div class="star-rating" style="height: 1.5em; margin-bottom: 0.6rem;"></div>'
                    }
                    <p class="price">
                        ${formatPrice(product.price)}
                        ${product.oldPrice ? `<span class="old-price">${formatPrice(product.oldPrice)}</span>` : ''}
                    </p>
                    <button class="btn btn-primary add-to-cart-btn" data-product-id="${product.id}" ${stock === 0 ? 'disabled' : ''}>
                        ${stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                </div>`;
            return card;
        } catch (e) {
            err("Error rendering product card HTML for ID", product?.id, e);
            return null;
        }
    };

    // Update ALL wishlist buttons on the page based on current state
    const updateAllWishlistButtonStates = () => {
        try {
             document.querySelectorAll('.add-to-wishlist-btn, .add-to-wishlist-quick').forEach(button => {
                 if (button?.dataset?.productId) {
                     updateWishlistButtonState(button.dataset.productId, isInWishlist(button.dataset.productId));
                 }
             });
        } catch (e) {
            err("Error updating all wishlist button states:", e);
        }
    };


    // Event delegation handler for product grids
    const handleProductGridAction = (event) => {
        try {
            const target = event.target;
            const button = target.closest('button[data-product-id]');
            const link = target.closest('a[data-product-id]');
            const card = target.closest('.product-card');

            const productId = button?.dataset.productId || link?.dataset.productId;
            if (!productId) return;

            log("Grid action for product:", productId, "Target:", target.tagName);

            if (button?.classList.contains('add-to-cart-btn')) {
                event.preventDefault();
                addToCart(productId, 1, {}, event);
            }
            else if (button?.classList.contains('add-to-wishlist-quick') || button?.classList.contains('add-to-wishlist-btn')) {
                event.preventDefault();
                toggleWishlist(productId);
            }
            else if (button?.classList.contains('remove-from-wishlist-btn') && body.classList.contains('wishlist-page')) {
                event.preventDefault();
                if (confirm("Remove this item from your wishlist?")) {
                    removeFromWishlist(productId);
                    // Animate removal (optional but nice)
                    if (card) {
                        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease, max-height 0.4s ease 0.1s, margin 0.4s ease 0.1s, padding 0.4s ease 0.1s';
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.95)';
                        card.style.maxHeight = '0px';
                        card.style.margin = '0';
                        card.style.padding = '0';
                        card.style.overflow = 'hidden';
                        setTimeout(() => {
                            card.remove();
                            // If wishlist becomes empty, show message
                            if (wishlist.length === 0) {
                                const grid = document.getElementById('wishlist-grid');
                                if (grid) renderEmptyWishlistMessage(grid);
                            }
                        }, 500); // slightly longer than transition
                    }
                }
            }
            else if (link && (link.closest('.product-image a') || link.closest('.product-info-card h3 a'))) {
                saveToSS('selectedProductId', productId);
                // Allow navigation
            }

        } catch (e) {
            err("handleProductGridAction error:", e);
        }
    };

    const renderEmptyMessage = (container, type = 'cart') => {
        try {
            if (!container) return;
            const message = type === 'cart'
                ? 'Your cart is empty. <a href="products.html" class="btn btn-secondary">Start Shopping!</a>'
                : 'Your wishlist is empty. <a href="products.html" class="btn btn-secondary">Explore Products!</a>';
             // Use a more descriptive class name
            container.innerHTML = `<div class="empty-state-message">${message}</div>`;
        } catch (e) {
            err("renderEmptyMessage error:", e);
            if(container) container.innerHTML = '<p>Error displaying content.</p>';
        }
    };
    // Specific function for wishlist empty message
    const renderEmptyWishlistMessage = (gridElement) => {
         renderEmptyMessage(gridElement, 'wishlist');
         const loadingMsg = document.getElementById('wishlist-loading-message');
         if (loadingMsg) loadingMsg.style.display = 'none';
    };


    // ===== 13. Form Validation & Handling =====
    const validateAndGetFormData = (formElement) => {
        try {
            if (!formElement || formElement.tagName !== 'FORM') {
                err("Invalid form element provided for validation.");
                return { isValid: false, formData: null, errors: { general: "Form not found or invalid." }, firstErrorField: null };
            }

            let isValid = true;
            let firstErrorField = null;
            const formData = {};
            const errors = {};

            // Clear previous errors more robustly
             formElement.querySelectorAll('.form-group.has-error').forEach(fg => fg.classList.remove('has-error'));
             formElement.querySelectorAll('.error-message').forEach(span => span.textContent = '');

            const fieldsToValidate = formElement.querySelectorAll('input[required], textarea[required], select[required], input[pattern], input[minlength]'); // Add pattern/minlength checks

            fieldsToValidate.forEach(field => {
                const formGroup = field.closest('.form-group');
                const errorSpan = formGroup?.querySelector('.error-message');
                let fieldValid = true;
                let customMessage = '';

                // --- Check Standard Validity ---
                field.setCustomValidity(''); // Clear previous native message first
                if (!field.checkValidity()) {
                    fieldValid = false;
                    customMessage = field.validationMessage; // Default browser message
                }

                // --- Add Specific Custom Validations (if needed) ---
                try {
                     const value = field.value.trim();
                     const fieldId = field.id;

                     // Example: Password confirmation (Register Page)
                     if (fieldId === 'confirmPassword') {
                         const passwordField = formElement.querySelector('#registerPassword');
                         if (passwordField && value !== passwordField.value.trim()) {
                             fieldValid = false;
                             customMessage = 'Passwords do not match.';
                         }
                     }
                    // Example: Ensure Indian Pincode doesn't start with 0 (stronger than just pattern)
                     if (fieldId === 'zip' && value && !/^[1-9][0-9]{5}$/.test(value)) {
                         fieldValid = false;
                         customMessage = 'Please enter a valid 6 digit Indian Pincode.';
                     }
                    // Add other custom checks here...

                } catch (validationRuleError) {
                    err("Error during custom validation rule for field:", field.id, validationRuleError);
                    fieldValid = false;
                    customMessage = "Invalid input format.";
                }
                // --- End Custom Validations ---


                if (!fieldValid) {
                    isValid = false;
                    const message = customMessage || 'This field is required.'; // Use custom or default message
                    errors[field.name || field.id] = message;

                    if (formGroup) formGroup.classList.add('has-error');
                    if (errorSpan) errorSpan.textContent = message;
                    else warn("No error message span found for field:", field.id);

                    field.setCustomValidity(message); // Set for browser feedback

                    if (!firstErrorField) firstErrorField = field;
                }
            }); // End of fieldsToValidate.forEach

            // Collect data from ALL fields (even non-required/validated ones)
            const allFields = formElement.querySelectorAll('input, textarea, select');
            allFields.forEach(field => {
                const name = field.name || field.id; // Use ID as fallback
                if (name) {
                    if (field.type === 'checkbox') formData[name] = field.checked;
                    else if (field.type === 'radio') { if (field.checked) formData[name] = field.value.trim(); }
                    else formData[name] = field.value.trim();
                } else {
                    warn("Form field missing both 'name' and 'id'. Value not collected.", field);
                }
            });

            if (!isValid && firstErrorField) {
                firstErrorField.focus();
                try { firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(scrollError) {}
            }

            log("Form Validation Result:", { isValid, errors: Object.keys(errors).length > 0 ? errors : 'None' });
            return { isValid, formData, errors, firstErrorField };

        } catch (e) {
            err("validateAndGetFormData error:", e);
            return { isValid: false, formData: null, errors: { general: "Validation check failed." }, firstErrorField: null };
        }
    };


    // ===== 14. Page Specific Initialization =====

    const getCurrentPage = () => {
        try {
            const path = window.location.pathname.split('/').pop() || 'index.html';
            // Simplify page names
            if (path === 'index.html' || path === '') return 'home';
            if (path === 'products.html') return 'products';
            if (path === 'product-details.html') return 'product-details';
            if (path === 'cart.html') return 'cart';
            if (path === 'checkout.html') return 'checkout';
            if (path === 'about.html') return 'about';
            if (path === 'contact.html') return 'contact';
            if (path === 'wishlist.html') return 'wishlist';
            if (path === 'register.html') return 'register';
            // if (path === 'login.html') return 'login';

            warn("Could not determine current page from path:", path);
            return 'unknown';
        } catch (e) {
            err("getCurrentPage error:", e);
            return 'unknown';
        }
    };

    // --- 14.1 Home Page Initialization ---
    const initHomePage = () => {
        log("Initializing Home Page...");
        body.classList.add('home-page');

        try { // Wrap page-specific logic
             // Hero Slider
             const heroSlider = document.querySelector('.hero-slider');
             if (heroSlider) {
                 const slides = heroSlider.querySelectorAll('.slide');
                 let currentSlideIndex = 0;
                 if (slides.length > 1) {
                     const showNextSlide = () => {
                         try {
                             slides[currentSlideIndex]?.classList.remove('active');
                             currentSlideIndex = (currentSlideIndex + 1) % slides.length;
                             slides[currentSlideIndex]?.classList.add('active');
                         } catch (slideErr) { err("Slider error", slideErr); }
                     };
                     if(slides[0]) slides[0].classList.add('active'); // Ensure first slide is active initially
                     setInterval(showNextSlide, 6000);
                 } else if (slides.length === 1 && slides[0]) {
                      slides[0].classList.add('active'); // Activate single slide
                 }
             }

             // Trending Products Grid
             const trendingGrid = document.getElementById('trending-product-grid');
             if (trendingGrid) {
                 trendingGrid.innerHTML = ''; // Clear placeholders
                 const trendingProducts = mockProducts
                     .filter(p => p && p.rating >= 4.3 && p.stock > 0)
                     .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
                     .slice(0, config.relatedProductsLimit);

                 if (trendingProducts.length > 0) {
                     const fragment = document.createDocumentFragment();
                     trendingProducts.forEach(product => {
                         const card = renderProductCard(product);
                         if (card) fragment.appendChild(card);
                     });
                     trendingGrid.appendChild(fragment);
                     trendingGrid.addEventListener('click', handleProductGridAction);
                 } else {
                     trendingGrid.innerHTML = '<p class="empty-state-message" style="grid-column: 1 / -1;">No trending products available right now.</p>';
                 }
             } else {
                 warn("Trending product grid not found.");
             }

             // Deal of the Day Countdown Timer
             const countdownTimerEl = document.getElementById('countdown-timer');
             if (countdownTimerEl) {
                 let targetDate = new Date();
                 targetDate.setDate(targetDate.getDate() + 1);
                 targetDate.setHours(0, 0, 0, 0);
                 let countdownInterval;

                 const updateCountdown = () => {
                     try {
                         const now = new Date().getTime();
                         const distance = targetDate - now;

                         if (distance < 0) {
                             countdownTimerEl.innerHTML = "<p>Deal Expired!</p>";
                             if (countdownInterval) clearInterval(countdownInterval);
                             return;
                         }
                         // Select elements inside for safety
                         const daysEl = countdownTimerEl.querySelector('.days');
                         const hoursEl = countdownTimerEl.querySelector('.hours');
                         const minutesEl = countdownTimerEl.querySelector('.minutes');
                         const secondsEl = countdownTimerEl.querySelector('.seconds');

                         if(daysEl && hoursEl && minutesEl && secondsEl) {
                             daysEl.textContent = String(Math.floor(distance / 86400000)).padStart(2, '0');
                             hoursEl.textContent = String(Math.floor((distance % 86400000) / 3600000)).padStart(2, '0');
                             minutesEl.textContent = String(Math.floor((distance % 3600000) / 60000)).padStart(2, '0');
                             secondsEl.textContent = String(Math.floor((distance % 60000) / 1000)).padStart(2, '0');
                         } else {
                             throw new Error("Countdown timer elements missing.");
                         }

                     } catch (cdErr) {
                         err("Countdown error", cdErr);
                         if (countdownInterval) clearInterval(countdownInterval);
                         countdownTimerEl.innerHTML = "<p>Error updating timer</p>";
                     }
                 };
                 updateCountdown(); // Initial call
                 countdownInterval = setInterval(updateCountdown, 1000);
             } else {
                 warn("Countdown timer element not found.");
             }

             // Newsletter Form
             const newsletterForm = document.getElementById('newsletter-form');
             if (newsletterForm) {
                 newsletterForm.addEventListener('submit', (e) => {
                     e.preventDefault();
                     const emailInput = newsletterForm.querySelector('input[type="email"]');
                     if (emailInput && emailInput.checkValidity() && emailInput.value.trim()) {
                         showToast(`Thanks for subscribing, ${sanitizeHTML(emailInput.value)}! (Mock)`, 4000);
                         emailInput.value = '';
                     } else {
                         showToast("Please enter a valid email address.");
                         if (emailInput) emailInput.focus();
                     }
                 });
             } else {
                 warn("Newsletter form not found.");
             }
        } catch (pageError) {
            err("Error initializing Home Page:", pageError);
        }
    };

    // --- 14.2 Products Page Initialization ---
    const initProductsPage = () => {
        log("Initializing Products Page...");
        body.classList.add('products-page');

        // Select crucial elements first
        const productGrid = document.getElementById('product-grid');
        if (!productGrid) {
            err("CRITICAL: Product grid element (#product-grid) not found on products page. Aborting initProductsPage.");
            // Maybe display an error message to the user on the page itself
            const container = document.querySelector('.products-page .container');
            if (container) container.innerHTML = '<p class="error-message">Error loading products display. Please try refreshing.</p>';
            return;
        }

        // Select other elements, check later if null
        const categoryFilter = document.getElementById('category-filter');
        const searchInput = document.getElementById('search-input');
        const priceRange = document.getElementById('price-range');
        const priceValue = document.getElementById('price-range-value');
        const resetFiltersBtn = document.getElementById('reset-filters-btn');
        const productCountInfo = document.getElementById('product-count-info');
        const loadingMessage = document.getElementById('products-loading-message');
        const sortDropdown = document.getElementById('sort-by-filter'); // Assuming ID exists

        let currentRenderedProducts = []; // State for this page

        try { // Wrap the whole setup in try/catch
            // --- Filtering and Rendering Logic ---
            const applyFiltersAndRender = () => {
                 // Defensive check: Ensure mockProducts is populated
                 if (!mockProducts || mockProducts.length === 0) {
                     warn("applyFiltersAndRender called but mockProducts is empty or invalid.");
                     productGrid.innerHTML = '<p class="empty-state-message">No products available at the moment.</p>';
                     if(loadingMessage) loadingMessage.style.display = 'none';
                     if(productCountInfo) productCountInfo.textContent = 'Showing 0 products';
                     return;
                 }

                try {
                    // Update filters state safely
                    currentFilters.category = categoryFilter?.value || 'all';
                    currentFilters.search = searchInput?.value.toLowerCase().trim() || '';
                    currentFilters.maxPrice = priceRange ? parseInt(priceRange.value) : (currentFilters.maxPrice || 999999);
                    currentFilters.sortBy = sortDropdown?.value || 'relevance';

                    log("Applying filters:", currentFilters);

                    // Filter products defensively
                    let filtered = mockProducts.filter(p => {
                        if (!p || typeof p.price !== 'number') return false; // Skip invalid products

                        const categoryMatch = currentFilters.category === 'all' || (p.category === currentFilters.category);
                        const searchMatch = !currentFilters.search ||
                            (p.name?.toLowerCase().includes(currentFilters.search)) ||
                            (p.description?.toLowerCase().includes(currentFilters.search)) ||
                            (p.category?.toLowerCase().includes(currentFilters.search)) ||
                            (p.tags && Array.isArray(p.tags) && p.tags.some(tag => tag?.toLowerCase().includes(currentFilters.search)));
                        const priceMatch = p.price <= currentFilters.maxPrice;

                        return categoryMatch && searchMatch && priceMatch;
                    });

                    // Sort filtered products safely
                    try {
                        if (currentFilters.sortBy === 'price_asc') filtered.sort((a, b) => (a?.price || 0) - (b?.price || 0));
                        else if (currentFilters.sortBy === 'price_desc') filtered.sort((a, b) => (b?.price || 0) - (a?.price || 0));
                        else if (currentFilters.sortBy === 'rating') filtered.sort((a, b) => (b?.rating || 0) - (a?.rating || 0));
                        else if (currentFilters.sortBy === 'name_asc') filtered.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
                        else if (currentFilters.sortBy === 'name_desc') filtered.sort((a, b) => (b?.name || '').localeCompare(a?.name || ''));
                    } catch (sortError) {
                         err("Error during sorting:", sortError);
                         // Proceed with unsorted filtered data if sorting fails
                    }


                    currentRenderedProducts = filtered;
                    renderProductGrid(currentRenderedProducts);

                } catch (e) {
                    err("Error applying filters:", e);
                    productGrid.innerHTML = '<p class="error-message" style="grid-column: 1 / -1;">Error filtering products.</p>';
                     if(loadingMessage) loadingMessage.style.display = 'none';
                }
            };

            // --- Rendering the Grid ---
            const renderProductGrid = (productsToRender) => {
                 // productGrid is guaranteed to exist from the check at the start
                 productGrid.innerHTML = ''; // Clear previous content

                if (!productsToRender || productsToRender.length === 0) {
                    renderEmptyMessage(productGrid, 'products');
                } else {
                    const fragment = document.createDocumentFragment();
                    productsToRender.forEach(product => {
                         if(product && typeof product.id !== 'undefined') { // Extra check
                            const card = renderProductCard(product);
                            if (card) fragment.appendChild(card);
                         } else {
                            warn("Skipping invalid product data during render:", product);
                         }
                    });
                    productGrid.appendChild(fragment);
                }

                if (productCountInfo) {
                    productCountInfo.textContent = `Showing ${productsToRender?.length || 0} of ${mockProducts.length} products`;
                    productCountInfo.setAttribute('aria-live', 'polite');
                }
                 if (loadingMessage) loadingMessage.style.display = 'none';
            };

            // --- Filter Initialization ---
             // Calculate max price safely
             const maxProductPrice = mockProducts.length > 0
                 ? Math.ceil(Math.max(...mockProducts.map(p => p?.price || 0)) / 1000) * 1000
                 : 100000; // Default if no products

            currentFilters = { category: 'all', search: '', maxPrice: maxProductPrice, sortBy: 'relevance' };

            // Populate Category Filter
            if (categoryFilter) {
                categoryFilter.innerHTML = '<option value="all">All Categories</option>';
                 if (mockCategories && mockCategories.length > 0) {
                     mockCategories.forEach(cat => {
                         const option = document.createElement('option');
                         option.value = cat;
                         option.textContent = cat;
                         categoryFilter.appendChild(option);
                     });
                 } else {
                     warn("No categories found to populate filter.");
                 }

                // Handle URL parameter
                const urlParams = new URLSearchParams(window.location.search);
                const categoryParam = urlParams.get('category');
                if (categoryParam && mockCategories.includes(categoryParam)) {
                    categoryFilter.value = categoryParam;
                    currentFilters.category = categoryParam;
                }
                categoryFilter.addEventListener('change', applyFiltersAndRender);
            } else { warn("Category filter element not found."); }

            // Price Range Filter
            if (priceRange && priceValue) {
                priceRange.max = maxProductPrice;
                priceRange.value = maxProductPrice;
                priceValue.textContent = formatPrice(maxProductPrice);
                priceRange.addEventListener('input', debounce(() => {
                    if (priceValue) priceValue.textContent = formatPrice(parseInt(priceRange.value));
                }, 50));
                priceRange.addEventListener('change', applyFiltersAndRender);
            } else { warn("Price range filter elements not found."); }

            // Search Input Filter
            if (searchInput) {
                searchInput.addEventListener('input', debounce(applyFiltersAndRender, config.debounceDelay));
            } else { warn("Search input filter element not found."); }

            // Sort Dropdown
            if (sortDropdown) {
                sortDropdown.value = currentFilters.sortBy;
                sortDropdown.addEventListener('change', applyFiltersAndRender);
            } else { warn("Sort dropdown element not found."); }


            // Reset Filters Button
            if (resetFiltersBtn) {
                resetFiltersBtn.addEventListener('click', () => {
                    if (categoryFilter) categoryFilter.value = 'all';
                    if (searchInput) searchInput.value = '';
                    if (priceRange && priceValue) {
                        priceRange.value = maxProductPrice;
                        priceValue.textContent = formatPrice(maxProductPrice);
                    }
                    if (sortDropdown) sortDropdown.value = 'relevance';
                    currentFilters = { category: 'all', search: '', maxPrice: maxProductPrice, sortBy: 'relevance' };
                    applyFiltersAndRender();
                    showToast("Filters reset.");
                });
            } else { warn("Reset filters button not found."); }

            // Add event listener for grid actions
            productGrid.addEventListener('click', handleProductGridAction);

            // Initial render
            log("Performing initial render for products page...");
            applyFiltersAndRender();

        } catch (pageError) {
            err("Error initializing Products Page:", pageError);
            productGrid.innerHTML = '<p class="error-message" style="grid-column: 1 / -1;">Error loading products.</p>';
             if(loadingMessage) loadingMessage.style.display = 'none';
        }
    };

    // --- 14.3 Product Details Page Initialization ---
    const initProductDetailsPage = () => {
        log("Initializing Product Details Page...");
        body.classList.add('product-details-page');

        const container = document.getElementById('product-details-container');
        if (!container) {
            err("CRITICAL: Product details container (#product-details-container) not found.");
            return;
        }

        try { // Wrap entire page logic
             // --- Get Product ID ---
             let productId = null;
             try {
                 const hashId = parseInt(window.location.hash.substring(1));
                 if (!isNaN(hashId) && hashId > 0) productId = hashId;
                 else {
                     const storedId = getFromSS('selectedProductId');
                     productId = storedId ? parseInt(storedId) : null;
                     if(productId) log("Using product ID from session storage:", productId);
                 }
             } catch (hashError) { err("Error reading product ID:", hashError); }

             // Find the product
             currentProduct = productId ? findProductById(productId) : null;

             // --- Render Product or Not Found Message ---
             if (!currentProduct) {
                 document.title = "Product Not Found - PremiumStore";
                 container.innerHTML = `
                     <div class="not-found-message">
                         <h2>Product Not Found</h2>
                         <p>Sorry, the product you are looking for (ID: ${productId || 'Unknown'}) does not exist or is unavailable.</p>
                         <a href="products.html" class="btn btn-primary">Back to Products</a>
                     </div>`;
                  // Add styling for .not-found-message if needed
                 return;
             }

             // --- Render Product Details ---
             try {
                 document.title = `${currentProduct.name} - PremiumStore`;

                 // Helper to update elements safely
                const updateElementHTML = (selector, content) => {
                    const el = container.querySelector(selector);
                    if (el) el.innerHTML = content ?? '';
                    else warn(`Element not found for HTML update: ${selector}`);
                };
                const updateElementText = (selector, content) => {
                    const el = container.querySelector(selector);
                    if (el) el.textContent = content ?? '';
                     else warn(`Element not found for text update: ${selector}`);
                };
                const updateAttribute = (selector, attribute, value) => {
                    const el = container.querySelector(selector);
                    if (el) el.setAttribute(attribute, value);
                    else warn(`Element not found for attribute update: ${selector}`);
                };
                 const displayElement = (selector, show = true) => {
                     const el = container.querySelector(selector);
                     if (el) el.style.display = show ? '' : 'none';
                     // else warn(`Element not found for display toggle: ${selector}`); // Less critical
                 };

                 // Basic Info
                 updateElementText('.product-info h1#product-name', sanitizeHTML(currentProduct.name)); // Use specific ID
                 const ratingContainer = container.querySelector('.product-info .star-rating#product-rating');
                 if(ratingContainer) {
                      if (currentProduct.rating) {
                          ratingContainer.innerHTML = `${renderStars(currentProduct.rating)} <a href="#customer-reviews" class="review-count">(${currentProduct.reviewCount || 0} Reviews)</a>`;
                          ratingContainer.title = `${currentProduct.rating.toFixed(1)} out of 5 stars`;
                          displayElement('.product-info .star-rating#product-rating', true);
                      } else {
                           displayElement('.product-info .star-rating#product-rating', false);
                      }
                 }
                 updateElementHTML('.product-info p.price#product-price',
                     `${formatPrice(currentProduct.price)} ${currentProduct.oldPrice ? `<span class="old-price">${formatPrice(currentProduct.oldPrice)}</span>` : ''}`);

                 // Description, Specs, Tags
                 updateElementHTML('#description-content', `<p>${sanitizeHTML(currentProduct.description || 'No description available.')}</p>`);

                 const specListEl = container.querySelector('#spec-list');
                 if (specListEl) {
                     let specsHTML = '';
                     if(currentProduct.sku) specsHTML += `<li><strong>SKU:</strong> ${currentProduct.sku}</li>`;
                     if(currentProduct.category) specsHTML += `<li><strong>Category:</strong> ${currentProduct.category}</li>`;
                     specsHTML += `<li><strong>Stock:</strong> ${currentProduct.stock > 0 ? (currentProduct.stock < 10 ? `Only ${currentProduct.stock} left!` : 'In Stock') : '<span style="color: var(--danger-color);">Out of Stock</span>'}</li>`;
                     if (currentProduct.weightKg) specsHTML += `<li><strong>Weight:</strong> ${currentProduct.weightKg} kg</li>`;
                     if (currentProduct.dimensionsCm) specsHTML += `<li><strong>Dimensions:</strong> ${currentProduct.dimensionsCm.length} x ${currentProduct.dimensionsCm.width} x ${currentProduct.dimensionsCm.height} cm</li>`;
                     specListEl.innerHTML = specsHTML || '<li>No specifications available.</li>';
                 }

                 const tagListEl = container.querySelector('#tag-list');
                 if (tagListEl) {
                    tagListEl.innerHTML = Array.isArray(currentProduct.tags) && currentProduct.tags.length > 0
                        ? currentProduct.tags.map(tag => `<span class="tag">${sanitizeHTML(tag)}</span>`).join(' ')
                        : 'No tags';
                 }

                 // Image Gallery
                 const mainImageContainer = container.querySelector('#main-image-container'); // Use specific ID
                 const thumbnailContainer = container.querySelector('#thumbnail-container'); // Use specific ID
                 if (mainImageContainer) {
                     if (currentProduct.images && currentProduct.images.length > 0) {
                         mainImageContainer.innerHTML = `<img src="${currentProduct.images[0]}" alt="${sanitizeHTML(currentProduct.name)}" id="main-product-image">`; // Add ID to main image
                         if (thumbnailContainer) {
                             thumbnailContainer.innerHTML = ''; // Clear
                             currentProduct.images.forEach((imgSrc, index) => {
                                 const thumb = document.createElement('div');
                                 thumb.className = `thumbnail ${index === 0 ? 'active' : ''}`;
                                 thumb.innerHTML = `<img src="${imgSrc}" alt="Thumbnail ${index + 1}" loading="lazy" onerror="this.style.display='none'">`;
                                 thumb.addEventListener('click', () => {
                                     const mainImg = document.getElementById('main-product-image'); // Select by ID
                                     if (mainImg && mainImg.src !== imgSrc) {
                                          mainImg.style.opacity = 0;
                                          setTimeout(() => { mainImg.src = imgSrc; mainImg.style.opacity = 1; }, 150);
                                     }
                                     thumbnailContainer.querySelectorAll('.thumbnail.active').forEach(t => t.classList.remove('active'));
                                     thumb.classList.add('active');
                                 });
                                 thumbnailContainer.appendChild(thumb);
                             });
                             displayElement('#thumbnail-container', true);
                         }
                     } else {
                          mainImageContainer.innerHTML = `<div class="image-placeholder">No Image</div>`;
                          if (thumbnailContainer) displayElement('#thumbnail-container', false);
                     }
                 }

                 // Product Options (Size/Color)
                 let selectedOptions = {}; // Store user's selections
                 const setupOptionButtons = (optionsContainerId, optionType, optionsList) => {
                     const optionsDiv = document.getElementById(optionsContainerId); // Select by ID
                     if (!optionsDiv) { warn(`Options container not found: #${optionsContainerId}`); return; }

                     const optionGroup = optionsDiv.closest('.option-group');
                     if (!optionGroup) { warn(`Option group not found for: #${optionsContainerId}`); return; }

                     const buttonsContainer = optionsDiv.querySelector('.option-buttons');
                     if (!buttonsContainer) { warn(`Option buttons container not found within: #${optionsContainerId}`); return; }

                     if (Array.isArray(optionsList) && optionsList.length > 0) {
                         optionGroup.style.display = '';
                         buttonsContainer.innerHTML = '';
                         optionsList.forEach(optionValue => {
                             const btn = document.createElement('button');
                             btn.className = `${optionType}-btn`;
                             btn.dataset.value = optionValue;
                             btn.type = 'button';
                             btn.setAttribute('aria-label', `${optionType}: ${optionValue}`);

                             if (optionType === 'color') {
                                 btn.style.backgroundColor = String(optionValue || '').toLowerCase().replace(/\s+/g, '');
                                 btn.title = optionValue;
                                  const lightColors = ['white', '#ffffff', 'ivory', 'beige', 'lightyellow', 'lightgrey', 'yellow'];
                                  if (lightColors.includes(String(optionValue || '').toLowerCase())) {
                                       btn.style.border = '1px solid var(--border-color-subtle)';
                                  }
                             } else {
                                 btn.textContent = optionValue;
                             }

                             btn.addEventListener('click', () => {
                                 buttonsContainer.querySelectorAll(`.${optionType}-btn.selected`).forEach(b => b.classList.remove('selected'));
                                 btn.classList.add('selected');
                                 selectedOptions[optionType] = optionValue;
                                 log("Selected option:", selectedOptions);
                             });
                             buttonsContainer.appendChild(btn);
                         });
                     } else {
                         optionGroup.style.display = 'none';
                     }
                 };

                 setupOptionButtons('size-options', 'size', currentProduct.options?.sizes);
                 setupOptionButtons('color-options', 'color', currentProduct.options?.colors);

                 // Quantity Controls
                 const quantityInput = container.querySelector('#quantity-detail');
                 const qtyDecreaseBtn = container.querySelector('.quantity-controls .quantity-decrease');
                 const qtyIncreaseBtn = container.querySelector('.quantity-controls .quantity-increase');
                 let currentQuantity = 1;

                 if (quantityInput) {
                     quantityInput.value = currentQuantity;
                     quantityInput.max = currentProduct.stock > 0 ? String(currentProduct.stock) : "1"; // Prevent setting max=0
                     quantityInput.min = "1";

                     quantityInput.addEventListener('change', () => {
                         let val = parseInt(quantityInput.value);
                         const maxStock = currentProduct.stock;
                         if (isNaN(val) || val < 1) val = 1;
                         if (maxStock > 0 && val > maxStock) {
                             val = maxStock;
                             showToast(`Maximum stock (${maxStock}) reached.`);
                         } else if (maxStock === 0) {
                             val = 1; // Cannot increase if stock is 0
                             showToast(`Item is out of stock.`);
                         }
                         currentQuantity = val;
                         quantityInput.value = val;
                     });

                     if (qtyDecreaseBtn) {
                          qtyDecreaseBtn.addEventListener('click', () => {
                              if (currentQuantity > 1) {
                                  currentQuantity--;
                                  quantityInput.value = currentQuantity;
                              }
                          });
                     } else { warn("Quantity decrease button not found."); }

                     if (qtyIncreaseBtn) {
                          qtyIncreaseBtn.addEventListener('click', () => {
                              const maxStock = currentProduct.stock;
                              if (maxStock === 0) {
                                   showToast(`Item is out of stock.`);
                              } else if (currentQuantity < maxStock) {
                                  currentQuantity++;
                                  quantityInput.value = currentQuantity;
                              } else {
                                  showToast(`Maximum stock (${maxStock}) reached.`);
                              }
                          });
                     } else { warn("Quantity increase button not found."); }

                      // Disable controls if out of stock
                      if (currentProduct.stock === 0) {
                           quantityInput.disabled = true;
                           if(qtyDecreaseBtn) qtyDecreaseBtn.disabled = true;
                           if(qtyIncreaseBtn) qtyIncreaseBtn.disabled = true;
                      }

                 } else { warn("Quantity input not found."); }


                 // Action Buttons
                 const addToCartBtn = container.querySelector('.add-to-cart-btn');
                 const addToWishlistBtn = container.querySelector('.add-to-wishlist-btn');

                 if (addToCartBtn) {
                     addToCartBtn.disabled = currentProduct.stock === 0;
                     addToCartBtn.dataset.productId = currentProduct.id;
                     addToCartBtn.textContent = currentProduct.stock === 0 ? 'Out of Stock' : 'Add to Cart';
                     addToCartBtn.addEventListener('click', (event) => {
                          addToCart(currentProduct.id, currentQuantity, selectedOptions, event);
                     });
                 } else { warn("Add to Cart button not found."); }

                 if (addToWishlistBtn) {
                     addToWishlistBtn.disabled = false;
                     addToWishlistBtn.dataset.productId = currentProduct.id;
                     updateWishlistButtonState(currentProduct.id, isInWishlist(currentProduct.id));
                     addToWishlistBtn.addEventListener('click', () => toggleWishlist(currentProduct.id));
                 } else { warn("Add to Wishlist button not found."); }

                 // Reviews Section
                 const reviewsListDiv = document.getElementById('reviews-list'); // Select by ID
                 const noReviewsMsg = document.getElementById('no-reviews-message'); // Select by ID
                 if (reviewsListDiv && noReviewsMsg) {
                     renderReviews(reviewsListDiv, noReviewsMsg, currentProduct.reviews || []);
                 } else { warn("Reviews list or no-reviews message element not found."); }

                 // Review Form Handling
                 const reviewForm = document.getElementById('review-form');
                 if (reviewForm) {
                     handleReviewForm(reviewForm, currentProduct.id, reviewsListDiv, noReviewsMsg);
                 } else { warn("Review form not found."); }

                 // Questions & Answers Section
                 const qaListDiv = document.getElementById('questions-list'); // Select by ID
                 const noQaMsg = document.getElementById('no-questions-message'); // Select by ID
                 if (qaListDiv && noQaMsg) {
                     renderQuestions(qaListDiv, noQaMsg, currentProduct.questions || []);
                 } else { warn("Q&A list or no-questions message element not found."); }

                 // QA Form Handling
                 const qaForm = document.getElementById('ask-question-form');
                 if (qaForm) {
                      handleQaForm(qaForm, currentProduct.id, qaListDiv, noQaMsg);
                 } else { warn("Ask question form not found."); }

             } catch (renderError) {
                 err("Error rendering product details content:", renderError);
                 container.innerHTML = `<p class="error-message">Error displaying product details.</p>`;
             }

        } catch (pageError) {
             err("Error initializing Product Details Page:", pageError);
             if(container) container.innerHTML = '<p class="error-message">Could not load product information.</p>';
        }
    };

    // Helper function to render reviews
    const renderReviews = (listDiv, noMsgDiv, reviews) => {
        if (!listDiv || !noMsgDiv) return; // Ensure elements exist
        try {
            listDiv.innerHTML = '';
            if (reviews && reviews.length > 0) {
                noMsgDiv.style.display = 'none';
                const fragment = document.createDocumentFragment();
                reviews.forEach(review => {
                     if(!review) return; // Skip invalid review data
                    const reviewEl = document.createElement('div');
                    reviewEl.className = 'review fade-in';
                    reviewEl.innerHTML = `
                        <div class="review-header">
                            <span class="reviewer-name">${sanitizeHTML(review.reviewer || 'Anonymous')}</span>
                            <span class="review-date">${formatDate(review.date)}</span>
                        </div>
                        <div class="star-rating">${renderStars(review.rating)}</div>
                        <p class="review-text">${sanitizeHTML(review.text)}</p>
                        <div class="review-actions">
                            <button type="button" class="helpful-btn" data-helpful="yes" aria-label="Mark review as helpful">👍 Helpful</button>
                            <button type="button" class="helpful-btn" data-helpful="no" aria-label="Mark review as not helpful">👎 Not Helpful</button>
                            <span class="helpful-count">(0)</span>
                        </div>
                    `;
                    fragment.appendChild(reviewEl);
                });
                listDiv.appendChild(fragment);

                // Add delegated event listener for helpful buttons
                listDiv.addEventListener('click', handleHelpfulClick);

            } else {
                noMsgDiv.style.display = 'block';
            }
        } catch (e) {
            err("Error rendering reviews:", e);
            listDiv.innerHTML = '<p class="error-message">Could not display reviews.</p>';
             noMsgDiv.style.display = 'none';
        }
    };

     // Separate handler for helpful button clicks
     const handleHelpfulClick = (e) => {
         if (e.target.classList.contains('helpful-btn')) {
             const button = e.target;
             const actionsDiv = button.closest('.review-actions');
             const countSpan = actionsDiv?.querySelector('.helpful-count');
             const reviewDiv = button.closest('.review'); // Find parent review

             // Prevent multiple votes per review instance
             if (!reviewDiv?.dataset.voted && actionsDiv) {
                  reviewDiv.dataset.voted = 'true'; // Mark as voted
                  actionsDiv.querySelectorAll('.helpful-btn').forEach(btn => {
                       btn.disabled = true;
                       btn.classList.add('voted');
                  });
                  if (countSpan) {
                       const currentCount = parseInt(countSpan.textContent.replace(/[()]/g, '')) || 0;
                       countSpan.textContent = `(${currentCount + 1})`;
                  }
                  showToast("Thanks for your feedback! (Mock)");
             }
         }
     };

    // Helper function to handle review form submission
    const handleReviewForm = (form, productId, listDiv, noMsgDiv) => {
        if(!form) return;

        // Setup star rating input interaction
        const ratingContainer = form.querySelector('.star-rating-input');
        if (ratingContainer) {
             try { // Wrap star setup in try/catch
                 const labels = ratingContainer.querySelectorAll('label');
                 const inputs = ratingContainer.querySelectorAll('input[type="radio"]');
                 const resetStars = () => labels.forEach((lbl, index) => {
                      const input = inputs[index];
                      if (input) lbl.style.color = input.checked ? 'var(--secondary-color)' : 'var(--border-color)';
                 });
                 ratingContainer.addEventListener('mouseover', (e) => {
                      if (e.target.tagName === 'LABEL') {
                           const currentVal = parseInt(e.target.dataset.ratingValue || '0');
                           labels.forEach((lbl, index) => lbl.style.color = index < currentVal ? 'var(--secondary-color)' : 'var(--border-color)');
                      }
                 });
                 ratingContainer.addEventListener('mouseout', resetStars);
                 ratingContainer.addEventListener('change', resetStars);
                 labels.forEach((lbl, i) => lbl.dataset.ratingValue = i + 1);
                 resetStars();
             } catch (starError) {
                  err("Error setting up star rating input:", starError);
             }
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitButton = form.querySelector('button[type="submit"]');
            if(submitButton) setLoadingState(submitButton, true);

            // Perform validation, ensuring rating is checked
            const validationResult = validateAndGetFormData(form);
            const ratingInput = form.querySelector('input[name="rating"]:checked');
            let ratingError = false;

            if (!ratingInput) {
                validationResult.isValid = false;
                validationResult.errors = validationResult.errors || {};
                validationResult.errors.rating = "Please select a star rating.";
                ratingError = true;
            } else {
                 validationResult.formData.rating = ratingInput.value;
            }

             // Visually handle rating error
            const ratingGroup = ratingContainer?.closest('.form-group');
            if (ratingGroup) {
                 ratingGroup.classList.toggle('has-error', ratingError);
                 const errSpan = ratingGroup.querySelector('.error-message');
                 if (errSpan) errSpan.textContent = ratingError ? validationResult.errors.rating : '';
            }


            if (validationResult.isValid) {
                setTimeout(() => {
                    try {
                        const newReview = {
                            reviewer: validationResult.formData.reviewName || 'Anonymous',
                            rating: parseInt(validationResult.formData.rating),
                            text: validationResult.formData.reviewText,
                            date: new Date().toISOString()
                        };

                        const productIndex = mockProducts.findIndex(p => p?.id === productId);
                        if (productIndex > -1 && mockProducts[productIndex]) {
                            mockProducts[productIndex].reviews = [newReview, ...(mockProducts[productIndex].reviews || [])]; // Add to beginning
                            renderReviews(listDiv, noMsgDiv, mockProducts[productIndex].reviews);
                        } else { warn("Could not find product in mock data to add review to."); }

                        showToast("Review submitted successfully! (Mock)");
                        form.reset();
                         if (ratingContainer) ratingContainer.dispatchEvent(new Event('mouseout')); // Reset stars
                         form.querySelectorAll('.form-group.has-error').forEach(fg => fg.classList.remove('has-error'));
                         form.querySelectorAll('.error-message').forEach(span => span.textContent = '');
                    } catch(submitErr) {
                        err("Error submitting review:", submitErr);
                        showToast("Error submitting review. Please try again.", 5000);
                    } finally {
                         if(submitButton) setLoadingState(submitButton, false);
                    }
                }, config.mockApiDelay * 2);

            } else {
                showToast("Please correct the errors in the form.", 4000);
                 if(submitButton) setLoadingState(submitButton, false);
                 // Ensure first error field is focused if validation failed
                 validationResult.firstErrorField?.focus();
            }
        });
    };

    // Helper function to render Q&A
    const renderQuestions = (listDiv, noMsgDiv, questions) => {
        if (!listDiv || !noMsgDiv) return;
         try {
            listDiv.innerHTML = '';
            if (questions && questions.length > 0) {
                noMsgDiv.style.display = 'none';
                const fragment = document.createDocumentFragment();
                questions.forEach(qa => {
                     if(!qa || !qa.q) return; // Skip invalid QA
                    const qaEl = document.createElement('div');
                    qaEl.className = 'qa-item fade-in';
                    qaEl.innerHTML = `
                        <p class="question"><strong>Q:</strong> ${sanitizeHTML(qa.q)}</p>
                        <p class="answer"><strong>A:</strong> ${sanitizeHTML(qa.a || 'Awaiting answer...')}</p>
                        ${qa.date ? `<span class="qa-date">${formatDate(qa.date)}</span>` : ''}
                    `;
                    fragment.appendChild(qaEl);
                });
                listDiv.appendChild(fragment);
            } else {
                noMsgDiv.style.display = 'block';
            }
         } catch(e) {
             err("Error rendering Q&A:", e);
             listDiv.innerHTML = '<p class="error-message">Could not display questions.</p>';
             noMsgDiv.style.display = 'none';
         }
    };

    // Helper function to handle Q&A form submission
    const handleQaForm = (form, productId, listDiv, noMsgDiv) => {
         if(!form) return;
         form.addEventListener('submit', (e) => {
              e.preventDefault();
              const questionInput = form.querySelector('textarea[name="questionText"]');
              const submitButton = form.querySelector('button[type="submit"]');
              const questionText = questionInput?.value.trim();

              if (questionText) {
                  if(submitButton) setLoadingState(submitButton, true);
                  setTimeout(() => {
                        try {
                            showToast("Question submitted! (Mock - Answer will appear later)");
                            const newQa = { q: questionText, a: "Thank you for your question! Our team will answer it shortly.", date: new Date().toISOString() };

                            const productIndex = mockProducts.findIndex(p => p?.id === productId);
                            if (productIndex > -1 && mockProducts[productIndex]) {
                                mockProducts[productIndex].questions = [...(mockProducts[productIndex].questions || []), newQa]; // Add to end
                                renderQuestions(listDiv, noMsgDiv, mockProducts[productIndex].questions);
                            } else { warn("Could not find product in mock data to add question to."); }

                            if(questionInput) questionInput.value = '';
                        } catch (submitQaErr) {
                             err("Error submitting question:", submitQaErr);
                             showToast("Error submitting question. Please try again.", 5000);
                        } finally {
                            if(submitButton) setLoadingState(submitButton, false);
                        }
                  }, config.mockApiDelay * 1.5);
              } else {
                  showToast("Please enter your question.");
                  if (questionInput) questionInput.focus();
              }
          });
     };

    // --- 14.4 Cart Page Initialization ---
    const initCartPage = () => {
        log("Initializing Cart Page...");
        body.classList.add('cart-page');

        const cartItemsContainer = document.getElementById('cart-items');
        const cartSummaryContainer = document.getElementById('cart-summary');
        if (!cartItemsContainer || !cartSummaryContainer) {
            err("CRITICAL: Cart items or summary container not found!");
             // Display user-facing error if possible
             const pageContainer = document.querySelector('.cart-page .container');
             if(pageContainer) pageContainer.innerHTML = '<h1 class="section-title">Your Shopping Cart</h1><p class="error-message">Error loading cart display.</p>';
            return;
        }

        const checkoutButton = document.getElementById('checkout-button'); // Check existence later
        // Assuming promo elements might be inside summary, select robustly
        const promoCodeInput = cartSummaryContainer.querySelector('#promo-code-input');
        const applyPromoBtn = cartSummaryContainer.querySelector('#apply-promo-btn');
        const removePromoBtn = cartSummaryContainer.querySelector('#remove-promo-btn');
        const promoMessageDiv = cartSummaryContainer.querySelector('#promo-message');

        // Define renderCart function locally for this page
         const renderCart = () => {
             cartItemsContainer.innerHTML = ''; // Clear previous items

             if (cart.length === 0) {
                 renderEmptyMessage(cartItemsContainer, 'cart');
                 cartSummaryContainer.style.display = 'none'; // Hide summary
                 if (checkoutButton) {
                     checkoutButton.classList.add('disabled');
                     checkoutButton.setAttribute('aria-disabled', 'true');
                     checkoutButton.onclick = (e) => e.preventDefault(); // Prevent click
                 }
             } else {
                 cartSummaryContainer.style.display = ''; // Show summary
                 if (checkoutButton) {
                     checkoutButton.classList.remove('disabled');
                     checkoutButton.setAttribute('aria-disabled', 'false');
                     checkoutButton.onclick = null; // Remove prevention
                 }

                 const fragment = document.createDocumentFragment();
                 cart.forEach(item => {
                     if (!item || typeof item.id === 'undefined') { // Skip invalid items
                          warn("Skipping invalid item in cart:", item);
                          return;
                     }
                     const product = findProductById(item.id);
                     const name = item.name || product?.name || 'Unknown Product';
                     const image = item.image || product?.images?.[0] || defaultImage;
                     const price = item.price ?? product?.price ?? 0; // Use item price, fallback to product, then 0
                     const itemTotal = price * item.quantity;
                     const stock = product?.stock ?? 0;
                     const removeIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18px" height="18px"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;

                     const cartItemElement = document.createElement('div');
                     cartItemElement.className = 'cart-item fade-in';
                     cartItemElement.dataset.productId = item.id;

                     // Build options string safely
                     let optionsHTML = '';
                      if (item.options && (item.options.size || item.options.color)) {
                          optionsHTML = `<p class="cart-item-options"><small>
                              ${item.options.size ? `Size: ${sanitizeHTML(item.options.size)}` : ''}
                              ${item.options.size && item.options.color ? ', ' : ''}
                              ${item.options.color ? `Color: ${sanitizeHTML(item.options.color)}` : ''}
                          </small></p>`;
                      }


                     cartItemElement.innerHTML = `
                         <div class="cart-item-image">
                             <a href="product-details.html#${item.id}" data-product-id="${item.id}">
                                 <img src="${image}" alt="${sanitizeHTML(name)}" loading="lazy" onerror="this.onerror=null;this.src='${defaultImage}';">
                             </a>
                         </div>
                         <div class="cart-item-details">
                             <h4><a href="product-details.html#${item.id}" data-product-id="${item.id}">${sanitizeHTML(name)}</a></h4>
                             <p class="cart-item-unit-price">Price: ${formatPrice(price)}</p>
                             ${optionsHTML}
                         </div>
                         <div class="cart-item-price">${formatPrice(itemTotal)}</div>
                         <div class="quantity-controls">
                             <button class="quantity-decrease" type="button" data-product-id="${item.id}" title="Decrease quantity" aria-label="Decrease quantity">-</button>
                             <input type="number" value="${item.quantity}" min="1" ${stock > 0 ? `max="${stock}"` : ''} data-product-id="${item.id}" aria-label="Quantity" ${stock === 0 ? 'disabled' : ''}>
                             <button class="quantity-increase" type="button" data-product-id="${item.id}" title="Increase quantity" aria-label="Increase quantity" ${stock === 0 || item.quantity >= stock ? 'disabled' : ''}>+</button>
                         </div>
                         <button class="remove-item-btn" type="button" data-product-id="${item.id}" title="Remove Item" aria-label="Remove ${sanitizeHTML(name)} from cart">
                             ${removeIcon}
                         </button>
                     `;
                     fragment.appendChild(cartItemElement);
                 });
                 cartItemsContainer.appendChild(fragment);
                 updateCartSummaryUI(); // Update summary after rendering items
             }
         }; // End renderCart function

        // Define updateCartSummaryUI locally
        const updateCartSummaryUI = () => {
             // Select summary elements safely
             const summarySubtotal = cartSummaryContainer.querySelector('#summary-subtotal');
             const summaryShipping = cartSummaryContainer.querySelector('#summary-shipping');
             const summaryTax = cartSummaryContainer.querySelector('#summary-tax');
             const summaryTotal = cartSummaryContainer.querySelector('#summary-total');
             const summaryDiscount = cartSummaryContainer.querySelector('#summary-discount');
             const discountRow = summaryDiscount?.closest('.summary-row');

             const totals = calculateCartTotals();

             if (summarySubtotal) summarySubtotal.textContent = formatPrice(totals.subtotal);
             if (summaryShipping) summaryShipping.textContent = totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping);
             if (summaryTax) summaryTax.textContent = formatPrice(totals.tax);
             if (summaryTotal) summaryTotal.textContent = formatPrice(totals.total);

             if(discountRow) discountRow.style.display = totals.discount > 0 ? '' : 'none';
             if (summaryDiscount) summaryDiscount.textContent = `-${formatPrice(totals.discount)}`;

             if (promoMessageDiv) {
                 promoMessageDiv.textContent = totals.promoMessage || '';
                 promoMessageDiv.style.display = totals.promoMessage ? 'block' : 'none';
                 promoMessageDiv.className = totals.promoCode ? 'promo-message success' : 'promo-message'; // Add class if applied
             }

             if(removePromoBtn) removePromoBtn.style.display = appliedPromoCode ? 'inline-block' : 'none';
             if(promoCodeInput) {
                 promoCodeInput.value = appliedPromoCode ? appliedPromoCode.code : '';
                 promoCodeInput.disabled = !!appliedPromoCode;
             }
             if(applyPromoBtn) applyPromoBtn.disabled = !!appliedPromoCode;
        }; // End updateCartSummaryUI function

        // --- Event Listeners ---
        cartItemsContainer.addEventListener('click', (e) => { // Delegated listener
            const target = e.target;
            const cartItemDiv = target.closest('.cart-item');
            if (!cartItemDiv) return;

            const productId = cartItemDiv.dataset.productId;
            const currentItem = cart.find(item => item && item.id === parseInt(productId));

            if (target.classList.contains('quantity-decrease')) {
                if (currentItem && currentItem.quantity > 1) {
                    updateCartQuantity(productId, currentItem.quantity - 1);
                } else if (currentItem && currentItem.quantity === 1 && confirm(`Remove ${currentItem.name} from cart?`)) {
                     removeFromCart(productId);
                }
            } else if (target.classList.contains('quantity-increase')) {
                if (currentItem) {
                    updateCartQuantity(productId, currentItem.quantity + 1);
                }
            } else if (target.closest('.remove-item-btn')) {
                if (currentItem && confirm(`Remove ${currentItem.name} from cart?`)) {
                    removeFromCart(productId);
                }
            } else if (target.closest('a[data-product-id]')) {
                 saveToSS('selectedProductId', productId); // Save ID if product link clicked
            }
        });
         // Listener for direct input changes (debounced)
         cartItemsContainer.addEventListener('change', debounce((e) => {
             if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
                 const productId = e.target.dataset.productId;
                 const newQuantity = parseInt(e.target.value);
                 if (productId && !isNaN(newQuantity)) {
                      updateCartQuantity(productId, newQuantity);
                 }
             }
         }, 500)); // Delay after typing stops


        if (applyPromoBtn && promoCodeInput) {
            applyPromoBtn.addEventListener('click', () => {
                const code = promoCodeInput.value;
                if (!appliedPromoCode) applyPromoCode(code); // Only apply if none exists
            });
        }
        if (removePromoBtn) removePromoBtn.addEventListener('click', removePromoCode);

        // Listen for external updates
        document.addEventListener('cartUpdated', () => { if (getCurrentPage() === 'cart') renderCart(); });
        document.addEventListener('promoApplied', () => { if (getCurrentPage() === 'cart') updateCartSummaryUI(); });

        // Initial Render
        renderCart();
    };

    // --- 14.5 Checkout Page Initialization ---
    const initCheckoutPage = () => {
        log("Initializing Checkout Page...");
        body.classList.add('checkout-page');

        const checkoutForm = document.getElementById('checkout-form');
        const summaryContainer = document.getElementById('order-summary-checkout');
        const itemsSummaryDiv = document.getElementById('checkout-items-summary');
        const mainContainer = document.querySelector('.checkout-page .container'); // For empty cart message

        if (!checkoutForm || !summaryContainer || !mainContainer) {
             err("CRITICAL: Essential checkout elements not found (#checkout-form, #order-summary-checkout, or .container).");
             if(mainContainer) mainContainer.innerHTML = '<h1 class="section-title">Checkout</h1><p class="error-message">Error loading checkout page.</p>';
             return;
        }
        const confirmOrderBtn = checkoutForm.querySelector('button[type="submit"]');

        // --- Check if cart is empty ---
        if (!cart || cart.length === 0) {
            showToast("Your cart is empty. Redirecting to cart...", 3000);
            if (confirmOrderBtn) confirmOrderBtn.disabled = true;
            checkoutForm.style.display = 'none';
            summaryContainer.style.display = 'none';
            mainContainer.innerHTML = `<h1 class="section-title">Checkout</h1><div class="empty-state-message">Your cart is empty. <a href="cart.html" class="btn btn-secondary">Return to Cart</a></div>`;
            // Optionally redirect after delay
            // setTimeout(() => { window.location.href = 'cart.html'; }, 3000);
            return;
        }

        // --- Render Checkout Summary ---
        const renderCheckoutSummary = () => {
             try { // Wrap summary rendering
                 const subtotalEl = summaryContainer.querySelector('#checkout-subtotal');
                 const shippingEl = summaryContainer.querySelector('#checkout-shipping');
                 const taxEl = summaryContainer.querySelector('#checkout-tax');
                 const totalEl = summaryContainer.querySelector('#checkout-total');
                 const discountEl = summaryContainer.querySelector('#checkout-discount');
                 const discountRow = discountEl?.closest('.summary-row');
                 const promoMessageDiv = summaryContainer.querySelector('#checkout-promo-message'); // Assume exists

                 const totals = calculateCartTotals();

                 if (subtotalEl) subtotalEl.textContent = formatPrice(totals.subtotal);
                 if (shippingEl) shippingEl.textContent = totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping);
                 if (taxEl) taxEl.textContent = formatPrice(totals.tax);
                 if (totalEl) totalEl.textContent = formatPrice(totals.total);

                 if(discountRow) discountRow.style.display = totals.discount > 0 ? '' : 'none';
                 if (discountEl) discountEl.textContent = `-${formatPrice(totals.discount)}`;

                 if (promoMessageDiv) {
                    promoMessageDiv.textContent = totals.promoMessage || '';
                    promoMessageDiv.style.display = totals.promoMessage ? 'block' : 'none';
                     promoMessageDiv.className = totals.promoCode ? 'promo-message success' : 'promo-message';
                 }

                 if (itemsSummaryDiv) {
                     itemsSummaryDiv.innerHTML = cart.map(item =>
                         item ? `<p>
                             <span>${sanitizeHTML(item.name || 'Item')} (x${item.quantity || 0})</span>
                             <span>${formatPrice((item.price || 0) * (item.quantity || 0))}</span>
                         </p>` : ''
                     ).join('');
                 }
             } catch (summaryError) {
                  err("Error rendering checkout summary:", summaryError);
                  if(itemsSummaryDiv) itemsSummaryDiv.innerHTML = '<p class="error-message">Error loading summary.</p>';
             }
        };

        // --- Pre-fill Form ---
        if (mockUser) {
             try {
                const nameField = checkoutForm.querySelector('#name');
                const emailField = checkoutForm.querySelector('#email');
                const phoneField = checkoutForm.querySelector('#phone');
                if (nameField && !nameField.value && mockUser.name) nameField.value = mockUser.name;
                if (emailField && !emailField.value && mockUser.email) emailField.value = mockUser.email;
                if (phoneField && !phoneField.value && mockUser.phone) phoneField.value = mockUser.phone;
             } catch (fillError) {
                  err("Error pre-filling form:", fillError);
             }
        }

        // --- Form Submission Handling ---
        if (confirmOrderBtn) {
            checkoutForm.addEventListener('submit', (e) => {
                e.preventDefault();
                setLoadingState(confirmOrderBtn, true, "Placing Order...");

                const validationResult = validateAndGetFormData(checkoutForm);

                if (validationResult.isValid) {
                    setTimeout(() => {
                        try {
                            const orderData = {
                                orderId: `PS-${Date.now()}`,
                                date: new Date().toISOString(),
                                items: JSON.parse(JSON.stringify(cart)), // Deep copy cart
                                totals: calculateCartTotals(appliedPromoCode),
                                shippingInfo: validationResult.formData,
                                paymentInfo: { cardType: "Visa", last4: validationResult.formData.cardNumber?.slice(-4) || '****' },
                                userId: mockUser?.id || null
                            };

                            const orders = getFromLS('orders') || [];
                            orders.push(orderData);
                            saveToLS('orders', orders);
                            log("Order placed (mock):", orderData);

                            cart = []; updateCart(); // Clear cart state
                            removePromoCode(); // Clear promo state

                            showToast(`Order #${orderData.orderId} placed successfully!`);
                            // Replace form/summary with success message
                             mainContainer.innerHTML = `
                                 <h1 class="section-title">Checkout</h1>
                                 <div class="checkout-success-message">
                                     <h2>🎉 Order Placed Successfully! 🎉</h2>
                                     <p>Your Order ID: <strong>${orderData.orderId}</strong></p>
                                     <p>A confirmation email has been sent to ${sanitizeHTML(orderData.shippingInfo.email)} (mock).</p>
                                     <p>Thank you for shopping with PremiumStore!</p>
                                     <div class="order-summary-details" id="order-summary-details" style="display:none;">
                                         <h4>Order Summary (Mock Data):</h4>
                                         <pre>${sanitizeHTML(JSON.stringify(orderData, null, 2))}</pre>
                                     </div>
                                     <div class="checkout-success-actions">
                                          <a href="index.html" class="btn btn-primary">Continue Shopping</a>
                                          <button id="show-summary-btn" type="button" class="btn btn-secondary">View Summary</button>
                                     </div>
                                 </div>`;
                             // Add listener for the new 'View Summary' button
                             const showSummaryBtn = document.getElementById('show-summary-btn');
                             const summaryDetailsDiv = document.getElementById('order-summary-details');
                             if(showSummaryBtn && summaryDetailsDiv) {
                                 showSummaryBtn.addEventListener('click', () => {
                                      const isHidden = summaryDetailsDiv.style.display === 'none';
                                      summaryDetailsDiv.style.display = isHidden ? 'block' : 'none';
                                      showSummaryBtn.textContent = isHidden ? 'Hide Summary' : 'View Summary';
                                 });
                             }

                        } catch (orderError) {
                            err("Error processing order:", orderError);
                            showToast("An error occurred while placing your order. Please try again.", 5000);
                            setLoadingState(confirmOrderBtn, false);
                        }
                    }, config.mockApiDelay * 3);

                } else {
                    showToast("Please correct the errors in the form.", 4000);
                    setLoadingState(confirmOrderBtn, false);
                    validationResult.firstErrorField?.focus(); // Focus first error
                }
            });
        } else {
             warn("Confirm Order button not found.");
        }

        // Initial render & listeners
        renderCheckoutSummary();
        document.addEventListener('cartUpdated', () => { if (getCurrentPage() === 'checkout') renderCheckoutSummary(); });
        document.addEventListener('promoApplied', () => { if (getCurrentPage() === 'checkout') renderCheckoutSummary(); });
    };

    // --- 14.6 About Page Initialization ---
    const initAboutPage = () => {
        log("Initializing About Page...");
        body.classList.add('about-page');
        // Intersection Observer logic seemed okay, ensure CSS classes exist
        // Add try/catch for robustness if complex logic is added later
        try {
             // Animate timeline items
             const timelineItems = document.querySelectorAll('.timeline-item');
             if (timelineItems.length > 0 && "IntersectionObserver" in window) {
                 const observer = new IntersectionObserver((entries, observerInstance) => {
                     entries.forEach(entry => {
                         if (entry.isIntersecting) {
                             entry.target.classList.add('visible');
                             observerInstance.unobserve(entry.target);
                         }
                     });
                 }, { threshold: 0.15 }); // Trigger earlier
                 timelineItems.forEach(item => observer.observe(item));
             } else { timelineItems.forEach(item => item.classList.add('visible')); }

             // Animate team members
             const teamMembers = document.querySelectorAll('.team-member-card');
              if (teamMembers.length > 0 && "IntersectionObserver" in window) {
                  const teamObserver = new IntersectionObserver((entries, observerInstance) => {
                      entries.forEach(entry => {
                          if (entry.isIntersecting) {
                              entry.target.classList.add('visible');
                              observerInstance.unobserve(entry.target);
                          }
                      });
                  }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
                  teamMembers.forEach(member => teamObserver.observe(member));
              } else { teamMembers.forEach(member => member.classList.add('visible')); }

        } catch (pageError) {
             err("Error initializing About Page animations:", pageError);
        }
    };

    // --- 14.7 Contact Page Initialization ---
    const initContactPage = () => {
        log("Initializing Contact Page...");
        body.classList.add('contact-page');

        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const submitButton = contactForm.querySelector('button[type="submit"]');
                 if(submitButton) setLoadingState(submitButton, true, "Sending...");

                const validationResult = validateAndGetFormData(contactForm);

                if (validationResult.isValid) {
                    setTimeout(() => {
                        try {
                            const contactData = { ...validationResult.formData, submittedAt: new Date().toISOString() };
                            const contacts = getFromLS('contacts') || [];
                            contacts.push(contactData);
                            saveToLS('contacts', contacts);
                            log("Contact form submitted (mock):", contactData);

                            showToast("Message sent successfully! We'll get back to you soon. (Mock)", 5000);
                            contactForm.reset();
                            contactForm.querySelectorAll('.form-group.has-error').forEach(fg => fg.classList.remove('has-error'));
                            contactForm.querySelectorAll('.error-message').forEach(span => span.textContent = '');
                        } catch (submitError) {
                             err("Error processing contact form:", submitError);
                             showToast("An error occurred. Please try again.", 5000);
                        } finally {
                             if(submitButton) setLoadingState(submitButton, false);
                        }
                    }, config.mockApiDelay * 2);
                } else {
                    showToast("Please fill out all required fields correctly.", 4000);
                    if(submitButton) setLoadingState(submitButton, false);
                     validationResult.firstErrorField?.focus();
                }
            });
        } else {
            warn("Contact form (#contact-form) not found.");
        }
    };

    // --- 14.8 Wishlist Page Initialization ---
    const initWishlistPage = () => {
        log("Initializing Wishlist Page...");
        body.classList.add('wishlist-page');

        const wishlistGrid = document.getElementById('wishlist-grid');
        const loadingMsg = document.getElementById('wishlist-loading-message');

        if (!wishlistGrid) {
             err("CRITICAL: Wishlist grid element (#wishlist-grid) not found!");
             return;
        }

        const renderWishlist = () => {
             wishlistGrid.innerHTML = ''; // Clear

             if (wishlist.length === 0) {
                 renderEmptyWishlistMessage(wishlistGrid);
             } else {
                 if (loadingMsg) loadingMsg.style.display = 'none';
                 const fragment = document.createDocumentFragment();
                 let validItemsRendered = 0;

                 wishlist.forEach(productId => {
                     const product = findProductById(productId);
                     if (product) {
                         const card = renderProductCard(product);
                         if (card) {
                             // Modify card for wishlist context
                             card.querySelector('.quick-actions')?.remove(); // Remove corner heart

                             const infoCard = card.querySelector('.product-info-card');
                             if (infoCard) {
                                 // Ensure Add to Cart button exists and is correct
                                let addToCartButton = infoCard.querySelector('.add-to-cart-btn');
                                if(!addToCartButton) { // If add-to-cart wasn't in the base render (should be)
                                    addToCartButton = document.createElement('button');
                                    addToCartButton.className = 'btn btn-primary add-to-cart-btn';
                                    addToCartButton.dataset.productId = product.id;
                                    // infoCard.appendChild(addToCartButton); // Append if missing - better to ensure it's rendered initially
                                }
                                 if (addToCartButton) { // Check again after potential creation
                                      addToCartButton.disabled = product.stock === 0;
                                      addToCartButton.textContent = product.stock === 0 ? 'Out of Stock' : 'Add to Cart';
                                 }


                                 // Add/Ensure "Remove" button
                                 let removeBtn = infoCard.querySelector('.remove-from-wishlist-btn');
                                 if (!removeBtn) {
                                      removeBtn = document.createElement('button');
                                      removeBtn.className = 'btn btn-secondary remove-from-wishlist-btn'; // Style as secondary
                                      removeBtn.dataset.productId = product.id;
                                      removeBtn.title = "Remove from Wishlist";
                                      removeBtn.textContent = 'Remove'; // Use text instead of icon for clarity here
                                 }

                                 // Create actions container if needed and append buttons
                                 let actionsDiv = infoCard.querySelector('.wishlist-actions');
                                 if (!actionsDiv) {
                                     actionsDiv = document.createElement('div');
                                     actionsDiv.className = 'wishlist-actions'; // Add class for styling
                                     // Append buttons in order
                                     if (addToCartButton) actionsDiv.appendChild(addToCartButton);
                                     actionsDiv.appendChild(removeBtn);
                                     infoCard.appendChild(actionsDiv); // Append actions container last
                                 } else {
                                     // Ensure buttons are inside if actionsDiv already exists
                                      if(addToCartButton && !actionsDiv.contains(addToCartButton)) actionsDiv.appendChild(addToCartButton);
                                      if(removeBtn && !actionsDiv.contains(removeBtn)) actionsDiv.appendChild(removeBtn);
                                 }
                             } // end if(infoCard)

                             fragment.appendChild(card);
                             validItemsRendered++;
                         }
                     } else {
                         warn(`Wishlist product ID ${productId} not found in data.`);
                     }
                 });

                 wishlistGrid.appendChild(fragment);
                  // Handle case where wishlist array has IDs but none match products
                  if(validItemsRendered === 0 && wishlist.length > 0) {
                       renderEmptyWishlistMessage(wishlistGrid);
                  }

             }
        }; // End renderWishlist

        wishlistGrid.addEventListener('click', handleProductGridAction); // Use delegation
        document.addEventListener('wishlistUpdated', () => { if (getCurrentPage() === 'wishlist') renderWishlist(); });

        // Initial Render
        renderWishlist();
    };

    // --- 14.9 Register Page Initialization ---
    const initRegisterPage = () => {
        log("Initializing Register Page...");
        body.classList.add('register-page');

        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const submitButton = registerForm.querySelector('button[type="submit"]');
                if(submitButton) setLoadingState(submitButton, true, "Registering...");

                const validationResult = validateAndGetFormData(registerForm);

                if (validationResult.isValid) {
                    setTimeout(() => {
                        try {
                             const newUser = { id: `user-${Date.now()}`, name: validationResult.formData.registerName, email: validationResult.formData.registerEmail };
                             saveToSS('currentUser', newUser);
                             mockUser = newUser;

                             log("Registration successful (mock):", newUser);
                             showToast(`Registration successful! Welcome, ${sanitizeHTML(newUser.name)}! Redirecting... (Mock)`, 4000);
                             registerForm.reset();
                             setTimeout(() => { window.location.href = 'index.html'; }, 1500);

                        } catch (regError) {
                             err("Error processing registration:", regError);
                             showToast("An error occurred during registration. Please try again.", 5000);
                             if(submitButton) setLoadingState(submitButton, false);
                        }
                    }, config.mockApiDelay * 2);
                } else {
                    showToast("Please correct the errors in the form.", 4000);
                    if(submitButton) setLoadingState(submitButton, false);
                     validationResult.firstErrorField?.focus();
                }
            });
        } else {
            warn("Register form (#register-form) not found.");
        }
    };


    // ===== 15. Global Initialization Function =====
    const initializeApp = () => {
        log("--- Starting App Initialization ---");
        try {
            // 1. Generate Mock Data
            generateMockData();
             // Sanity check data
             if (!Array.isArray(mockProducts) || !Array.isArray(mockCategories)) {
                  throw new Error("Mock data generation failed critically.");
             }
             log(`Data Check: ${mockProducts.length} products, ${mockCategories.length} categories.`);

            // 2. Load Initial State (Cart, Wishlist, Theme, User)
            loadInitialState();

            // 3. Initialize General UI Components (check element existence within)
            initScrollToTop();
            initMobileNav();
            initSearchBar();
            setFooterYear();
            setActiveNavLink();

            // 4. Load Icons (Crucial: do this *before* components that rely on icons being present)
             loadIcons();

            // 5. Add Global Event Listeners (like theme toggle)
            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', toggleTheme);
            } else {
                 warn("Theme toggle button not found.");
            }

            // 6. Initial UI Updates based on State
            updateCartIcon();
            updateWishlistHeaderIconState();
            updateAllWishlistButtonStates(); // Ensure buttons reflect loaded state

            // 7. Initialize Page-Specific Logic
            const currentPage = getCurrentPage();
            log(`Initializing page specific logic for: ${currentPage}`);
            switch (currentPage) {
                case 'home': initHomePage(); break;
                case 'products': initProductsPage(); break;
                case 'product-details': initProductDetailsPage(); break;
                case 'cart': initCartPage(); break;
                case 'checkout': initCheckoutPage(); break;
                case 'about': initAboutPage(); break;
                case 'contact': initContactPage(); break;
                case 'wishlist': initWishlistPage(); break;
                case 'register': initRegisterPage(); break;
                default: log("No specific initialization needed for this page.");
            }

             // 8. Initialize Scroll Animations (General)
             try {
                 const animatedElements = document.querySelectorAll('.fade-in, .fade-up, .slide-in-left, .slide-in-right, .zoom-in');
                 if ("IntersectionObserver" in window && animatedElements.length > 0) {
                     const observer = new IntersectionObserver((entries, observerInstance) => {
                         entries.forEach(entry => {
                             if (entry.isIntersecting) {
                                 entry.target.classList.add('visible');
                                 observerInstance.unobserve(entry.target);
                             }
                         });
                     }, { threshold: 0.1 });
                     animatedElements.forEach(el => observer.observe(el));
                 } else { animatedElements.forEach(el => el.classList.add('visible')); }
             } catch (animError) {
                  err("Error initializing scroll animations:", animError);
             }


            log("--- PremiumStore JS Initialization Complete ---");
            log("--- Designed and Developed by Atharva Zope ✨ ---");

        } catch (error) {
            err("CRITICAL error during app initialization:", error);
            // Display user-friendly message ONLY if loader is still visible
             if (loaderOverlay && loaderOverlay.style.display !== 'none') {
                document.body.innerHTML = '<div style="padding: 40px; text-align: center; color: #e74c3c; font-size: 1.2rem;">An error occurred loading the application. Please try refreshing the page. If the problem persists, please contact support.</div>';
             } else {
                // If loader is hidden, just log the error and maybe show a non-blocking toast
                showToast("A critical error occurred. Some features might not work.", 10000);
             }
        } finally {
             // Always ensure loader is hidden after initialization attempt
             // Use timeout to ensure it happens even if errors occur early
             setTimeout(hideLoader, 50);
        }
    };

    // ===== 16. Start the Application =====
    initializeApp();

}); // End DOMContentLoaded Listener
