package org.amadeus.amadeusserver;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Base64;

import javax.imageio.ImageIO;

import org.json.JSONArray;
import org.json.JSONObject;

public class ImageMatchService {
    public static JSONObject analyze(String base64Image, String textHint) throws IOException {
        byte[] imageBytes = Base64.getDecoder().decode(base64Image);
        String fingerprint = computeHash(imageBytes);

        JSONArray candidates = MediaStore.findSimilarItems(fingerprint, textHint);

        JSONObject response = new JSONObject();
        response.put("fingerprint", fingerprint);
        response.put("textHint", textHint);
        response.put("candidates", candidates);
        response.put("strategy", "hash-and-text-hint");
        return response;
    }

    private static String computeHash(byte[] imageBytes) throws IOException {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(imageBytes));
        if (image == null) {
            return null;
        }

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
