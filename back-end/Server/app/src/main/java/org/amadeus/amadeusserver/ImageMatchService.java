package org.amadeus.amadeusserver;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.EnumMap;
import java.util.Map;

import javax.imageio.ImageIO;

import org.json.JSONArray;
import org.json.JSONObject;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.LuminanceSource;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.Result;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.common.GlobalHistogramBinarizer;

public class ImageMatchService {
    
    /**
     * Analyzes an image for barcodes or cover art matches.
     * Returns a JSON object with success status and match details.
     */
    public static JSONObject analyze(String base64Image, String textHint) {
        try {
            // 1. Strip base64 prefix if present (e.g. "data:image/jpeg;base64,")
            if (base64Image != null && base64Image.contains(",")) {
                base64Image = base64Image.substring(base64Image.indexOf(",") + 1);
            }
            
            if (base64Image == null || base64Image.isBlank()) {
                return new JSONObject().put("success", false).put("message", "No image data provided");
            }

            byte[] imageBytes;
            try {
                imageBytes = Base64.getDecoder().decode(base64Image.trim());
            } catch (IllegalArgumentException e) {
                return new JSONObject().put("success", false).put("message", "Invalid base64 encoding");
            }

            BufferedImage image = ImageIO.read(new ByteArrayInputStream(imageBytes));
            if (image == null) {
                return new JSONObject().put("success", false).put("message", "Could not decode image pixels");
            }

            // 2. Try to extract barcode using ZXing
            String decodedBarcode = decodeBarcode(image);
            if (decodedBarcode != null) {
                System.out.println("[ImageMatchService] Decoded barcode: " + decodedBarcode);
                JSONObject barcodeResult = BarcodeService.searchByBarcode(decodedBarcode);
                
                JSONObject response = new JSONObject();
                response.put("strategy", "barcode-extraction");
                response.put("decodedBarcode", decodedBarcode);
                response.put("barcode", decodedBarcode);
                
                if (barcodeResult != null && barcodeResult.optBoolean("success", false)) {
                    // Success: Copy all data from lookup
                    for (String key : barcodeResult.keySet()) {
                        response.put(key, barcodeResult.get(key));
                    }
                    response.put("matchStatus", "verified");
                    response.put("success", true);
                } else {
                    // Barcode found but no metadata match
                    response.put("success", false);
                    response.put("matchStatus", "not-found");
                    response.put("message", "Barcode identified (" + decodedBarcode + ") but no matching item found in databases.");
                }
                return response;
            }

            // 3. Fallback to image fingerprinting (Cover Art match)
            String fingerprint = computeHash(image);
            JSONArray candidates = MediaStore.findSimilarItems(fingerprint, textHint);

            String ocrText = (textHint == null || textHint.isBlank()) ? "Unknown" : textHint.trim();
            JSONObject response = new JSONObject();
            response.put("success", candidates.length() > 0);
            response.put("fingerprint", fingerprint);
            response.put("ocrText", ocrText);
            response.put("textHint", textHint);
            response.put("candidates", candidates);
            response.put("strategy", "hash-and-text-hint");
            response.put("matchStatus", candidates.length() > 0 ? "verified" : "not-found");
            
            if (candidates.length() == 0) {
                response.put("message", "No barcode detected and no visual matches found in collection.");
            }
            
            return response;

        } catch (Throwable t) {
            System.err.println("[ImageMatchService] Unexpected error during scan: " + t.getMessage());
            t.printStackTrace();
            return new JSONObject()
                .put("success", false)
                .put("message", "Internal server error during image analysis: " + t.getMessage());
        }
    }

    private static String decodeBarcode(BufferedImage image) {
        // Try multiple binarization strategies to handle different lighting conditions
        String result = decodeWithBinarizer(image, true); // Hybrid (better for shadows/complex backgrounds)
        if (result == null) {
            result = decodeWithBinarizer(image, false); // Global (better for clean, high-contrast labels)
        }
        return result;
    }

    private static String decodeWithBinarizer(BufferedImage image, boolean useHybrid) {
        try {
            LuminanceSource source = new BufferedImageLuminanceSource(image);
            BinaryBitmap bitmap = new BinaryBitmap(useHybrid ? new HybridBinarizer(source) : new GlobalHistogramBinarizer(source));
            
            Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
            hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
            hints.put(DecodeHintType.POSSIBLE_FORMATS, java.util.Arrays.asList(
                com.google.zxing.BarcodeFormat.EAN_13,
                com.google.zxing.BarcodeFormat.EAN_8,
                com.google.zxing.BarcodeFormat.UPC_A,
                com.google.zxing.BarcodeFormat.UPC_E,
                com.google.zxing.BarcodeFormat.CODE_128,
                com.google.zxing.BarcodeFormat.CODE_39,
                com.google.zxing.BarcodeFormat.ITF
            ));

            Result result = new MultiFormatReader().decode(bitmap, hints);
            return result.getText();
        } catch (Exception e) {
            return null;
        }
    }

    private static String computeHash(BufferedImage image) {
        if (image == null) return null;

        BufferedImage scaled = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);
        var g = scaled.createGraphics();
        g.drawImage(image, 0, 0, 8, 8, null);
        g.dispose();

        long hash = 0L;
        int avg = 0;
        for (int y = 0; y < 8; y++) {
            for (int x = 0; x < 8; x++) {
                int rgb = scaled.getRGB(x, y);
                avg += ((rgb >> 16) & 0xff + (rgb >> 8) & 0xff + (rgb & 0xff)) / 3;
            }
        }
        avg /= 64;

        for (int y = 0; y < 8; y++) {
            for (int x = 0; x < 8; x++) {
                int rgb = scaled.getRGB(x, y);
                int lum = ((rgb >> 16) & 0xff + (rgb >> 8) & 0xff + (rgb & 0xff)) / 3;
                hash = (hash << 1) | (lum >= avg ? 1L : 0L);
            }
        }
        return Long.toHexString(hash);
    }
}
