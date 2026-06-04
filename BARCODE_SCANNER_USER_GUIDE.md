# Barcode Scanner - User Guide

## Quick Start

The barcode scanner is the fastest way to add items to your Amadeus collection!

### Method 1: Direct Scanner Page
1. From the **Dashboard**, click the **📱 Barcode Scanner** button
2. Enter or scan a barcode into the text field
3. Click **Search** or press **Enter**
4. Review the item information
5. Click **✓ Add to Collection** to add it

### Method 2: From Add Item Form
1. Go to **Add Item** page
2. Look for the **⚡ Quick Barcode Lookup** box at the top
3. Click **📱 Go to Barcode Scanner**
4. Follow Method 1

## Supported Barcode Types

The barcode scanner supports several barcode formats:

| Format | Example | Common Items |
|--------|---------|--------------|
| ISBN-13 (Books) | 9780544720435 | Books |
| ISBN-10 (Books) | 0544720431 | Older books |
| UPC/EAN (Products) | 5099750066429 | CDs, DVDs, Games |

## How to Scan

### Option 1: Physical Barcode Scanner
- Connect a barcode scanner device to your computer
- Place cursor in the input field
- Scan the barcode on your physical media
- The barcode code appears automatically
- Click **Search**

### Option 2: Manual Entry
- Click in the input field
- Type the barcode number manually
- Click **Search** or press **Enter**

## What Happens When You Search

When you search for a barcode, Amadeus looks in three places in order:

1. **Open Library** (for books with ISBN)
2. **Open Food Facts** (for products with UPC/EAN)
3. **Local Amadeus Catalog** (items you or other users added)

The first match found is displayed with:
- 📖 Title
- 👤 Artist/Author
- 📺 Media Type (Book, CD, DVD, etc.)
- 📅 Year
- 🎨 Cover image (if available)
- 🏷️ Source (where it came from)

## Not Found?

If your barcode isn't found:
- Click **Add Manually** to go to the manual add-item form
- Or click **Scan Again** to try a different barcode
- The item will be available for future scans once added

## Adding to Your Collection

Once you see the item details:

1. Review the information
   - Is the title correct?
   - Is the media type correct?
   - Do you need to edit any fields?

2. Click **✓ Add to Collection**
   - The item is added with the found information
   - You'll be taken to your collection page
   - You can edit details later if needed

## Pro Tips

- 📱 Use a **barcode scanner app** on your phone, then copy-paste into the input field
- 📚 ISBN barcodes work best (most accurate data)
- 🎬 DVDs and CDs often have multiple barcodes (UPC on back works great)
- ✏️ You can always edit item details after adding
- 🔄 Scan multiple items quickly without refreshing
- 📷 Point your camera at the barcode you want to scan

## Troubleshooting

**"No item found"**
- Check the barcode number for typos
- Try an ISBN-13 for books (more likely to find)
- Add it manually using the form

**"Network error"**
- Check your internet connection
- Try again in a few moments
- If it persists, add manually

**"Item added but with wrong data"**
- Click on the item in your collection to edit it
- Fix any incorrect information
- Save changes

## What Gets Added

When you add an item via barcode scan, it includes:

- Title
- Artist/Author (if available)
- Media Type
- Release Year (if available)
- Cover Image (if available)
- Barcode (for future reference)
- Source (where data came from)

You can add more details later:
- Format (Hardcover, Deluxe Edition, etc.)
- Condition (Mint, Good, Fair, etc.)
- Purchase info (price, date, location)
- Personal notes

## Keyboard Shortcuts

- **Enter** - Search (while input is focused)
- **Ctrl+Shift+S** - Focus barcode input (if implemented)
- **Escape** - Clear results (if implemented)

## Next Steps

After adding items:
- View your **📚 Collection**
- **👥 Add Friends** and view their collections
- **🛍️ List items for sale** on the marketplace
- **🔍 Search** for items by type

---

For technical details, see the [Barcode Scanner Implementation Guide](./BARCODE_SCANNER_IMPLEMENTATION.md).
