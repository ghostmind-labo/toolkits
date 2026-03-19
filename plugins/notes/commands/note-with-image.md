---
description: Create or Update a Potion note with image
---

When the user asks to create or update a Potion note that includes an image, follow this exact workflow:

## 1. Generate the image

Use the `artist` skill (`/nano-banana`) to generate the image via Nano Banana (Gemini CLI). Images are saved to `/tmp/

## 2. Upload to Google Drive

Use the `gws-drive-upload` skill to upload the generated image file to Google Drive.

## 3. Make the image public

After uploading, set the file permission so anyone can read it:

```bash
gws drive permissions create --params '{"fileId": "FILE_ID"}' --json '{"role": "reader", "type": "anyone"}'
```

## 4. Use the correct direct image URL

Do NOT use `https://drive.google.com/uc?export=view&id=FILE_ID` — this does not work for direct image embedding.

Use the `lh3.googleusercontent.com` CDN URL instead:

```
https://lh3.googleusercontent.com/d/FILE_ID
```

This is the only URL format that works for rendering images in Potion notes.

## 5. Create or update the note

Use `mcp__potion__create_note` or `mcp__potion__update_note` with:
- `cover_url`: the `lh3.googleusercontent.com` image URL
- `content`: markdown image syntax — `![title](https://lh3.googleusercontent.com/d/FILE_ID)`

The note title and image prompt are provided by the user.
