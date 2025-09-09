// Minimal frontend for MIUI LSA Decryptor
// Select a file, send to FastAPI backend, receive decrypted image, show download link

document.addEventListener('DOMContentLoaded', function() {
    const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
    const fileInput = document.getElementById('fileInput');
    const resultDiv = document.getElementById('result');
    const decryptBtn = document.getElementById('decryptBtn');
    const overlay = document.getElementById('loadingOverlay');
    const loadingVideo = document.getElementById('loadingVideo');
    const loadingMessage = document.getElementById('loadingMessage');

    decryptBtn.addEventListener('click', async function(event) {
        event.preventDefault();
        event.stopPropagation();
        resultDiv.innerHTML = '';
        const file = fileInput.files[0];
        if (!file) {
            resultDiv.innerHTML = '<p>Please select a .lsa or .lsav file.</p>';
            return;
        }
        // Client-side size validation
        if (file.size > MAX_UPLOAD_BYTES) {
            const mb = (MAX_UPLOAD_BYTES / (1024*1024)).toFixed(0);
            resultDiv.innerHTML = `<p style="color:crimson;">File too large. Maximum allowed size is ${mb} MB.</p>`;
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        const wmpCheckbox = document.getElementById('wmpCheckbox');
        if (wmpCheckbox && wmpCheckbox.checked) {
            formData.append('wmp', '1');
            if (loadingMessage) loadingMessage.textContent = 'Processing video (this may take longer)';
        } else {
            if (loadingMessage) loadingMessage.textContent = 'Loading...';
        }
        try {
            if (overlay) overlay.style.display = 'flex';
            if (loadingMessage) loadingMessage.style.display = 'block';
            if (loadingVideo) {
                try { loadingVideo.play(); } catch (e) { /* ignore */ }
            }
        } catch (e) { /* ignore UI errors */ }
        decryptBtn.disabled = true;
        try {
            const metaApi = document.querySelector('meta[name="api-base"]')?.getAttribute('content') || '';
            const envBase = '';
            const fallback = 'https://miui-lsav-decryptor-backend.onrender.com';
            const base = (metaApi && metaApi.trim()) ? metaApi.trim() : (envBase || fallback);
            const response = await fetch(`${base}/api/decrypt`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                let errorMsg = 'Unknown error';
                try {
                    const error = await response.json();
                    errorMsg = error.error || errorMsg;
                } catch {}
                resultDiv.innerHTML = `<p>Error decrypting ${file.name}: ${errorMsg}</p>`;
                return;
            }
            const blob = await response.blob();
            let outName = file.name.replace(/\.(lsa|lsav)$/i, '');
            const xname = response.headers.get('X-Filename');
            if (xname) {
                outName = xname;
            } else {
                const disp = response.headers.get('Content-Disposition');
                if (disp) {
                    const match = disp.match(/filename="?([^";]+)"?/);
                    if (match) outName = match[1];
                } else {
                    const ct = response.headers.get('Content-Type') || '';
                    let ext = '';
                    if (ct.includes('video')) ext = '.mp4';
                    else if (ct.includes('jpeg') || ct.includes('jpg')) ext = '.jpg';
                    else if (ct.includes('png')) ext = '.png';
                    else if (ct.includes('mpeg')) ext = '.mp4';
                    else if (blob && blob.type) {
                        if (blob.type.includes('video')) ext = '.mp4';
                        else if (blob.type.includes('jpeg')) ext = '.jpg';
                        else if (blob.type.includes('png')) ext = '.png';
                    }
                    outName = outName + (ext || '.bin');
                }
            }
            const inputExt = (file.name.match(/\.([^.]+)$/) || [])[1] || '';
            if (/lsav/i.test(inputExt)) {
                if (!/\.(mp4|mkv|mov|webm)$/i.test(outName)) {
                    const base = outName.replace(/\.[^.]+$/, '');
                    outName = base + '.mp4';
                }
            }
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = outName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            const dl = document.createElement('a');
            dl.href = objectUrl;
            dl.download = outName;
            dl.textContent = `Download ${outName}`;
            dl.className = 'download-link';
            resultDiv.appendChild(dl);
            try {
                if (overlay) overlay.style.display = 'none';
                if (loadingVideo) { try { loadingVideo.pause(); loadingVideo.currentTime = 0; } catch (e) {} }
            } catch (e) {}
            decryptBtn.disabled = false;
        } catch (err) {
            resultDiv.innerHTML = `<p>Error decrypting ${file.name}: ${err}</p>`;
            try {
                if (overlay) overlay.style.display = 'none';
                if (loadingVideo) { try { loadingVideo.pause(); loadingVideo.currentTime = 0; } catch (e) {} }
            } catch (e) {}
            decryptBtn.disabled = false;
        }
        return false;
    });
});
