const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' folder

// Function to extract emails from text
function extractEmails(text) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/gi;
    let emails = text.match(emailRegex) || [];
    const blacklistedExtensions = ['.jpg', '.jpeg', '.png', '.svg', '.gif', '.tga', '.bmp', '.zip', '.pdf', '.webp'];
    return emails.filter(email => !blacklistedExtensions.some(ext => email.toLowerCase().endsWith(ext)));
}

// Function to extract links from HTML and ensure they are from the same domain
function extractLinks(html, baseUrl) {
    const $ = cheerio.load(html);
    const links = [];
    $('a[href]').each((i, elem) => {
        let href = $(elem).attr('href');
        if (href) {
            href = href.split('#')[0];
            href = url.resolve(baseUrl, href);
            if (href.startsWith(baseUrl)) {
                links.push(href);
            }
        }
    });
    return links;
}

// Fetch page content
async function fetchPage(pageUrl) {
    try {
        const response = await axios.get(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
        return response.data;
    } catch (error) {
        return null;
    }
}

// Crawl website
async function crawlWebsite(startUrl) {
    const emailsFound = new Set();
    const visited = new Set();
    const queue = [startUrl];
    const baseUrl = `${url.parse(startUrl).protocol}//${url.parse(startUrl).host}`;
    let pagesCrawled = 0;

    while (queue.length > 0 && pagesCrawled < 40) {
        const currentUrl = queue.shift();
        if (visited.has(currentUrl)) continue;
        visited.add(currentUrl);

        const html = await fetchPage(currentUrl);
        if (!html) continue;
        pagesCrawled++;

        const emails = extractEmails(html);
        emails.forEach(email => emailsFound.add(email));

        const links = extractLinks(html, baseUrl);
        links.forEach(link => !visited.has(link) && queue.push(link));
    }

    return Array.from(emailsFound);
}

// Handle user-submitted URLs and return JSON response
app.post('/scrape', async (req, res) => {
    const urls = req.body.urls;
    const results = {};
    for (let website of urls) {
        results[website] = await crawlWebsite(website);
    }
    res.json(results); // Return JSON response
});

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
