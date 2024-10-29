const peer = new Peer();

const myIdDisplay = document.getElementById('my-id');
const copyButton = document.getElementById('copy-button');
const connectButton = document.getElementById('connectButton');
const peerIdInput = document.getElementById('peer-id-input');
const statusDisplay = document.getElementById('status');
const fileInput = document.getElementById('file');
const sendButton = document.getElementById('sendButton');
const downloadLink = document.getElementById('downloadLink');
const selectedFileDisplay = document.getElementById('selected-file');

const modal = document.getElementById('modal');
const modalMessage = document.getElementById('modal-message');
const progressBar = document.getElementById('progressBar');
const percentageDisplay = document.getElementById('percentage'); 
const speedDisplay = document.getElementById('speed'); 
const etaDisplay = document.getElementById('eta'); 

let conn;
let currentFile = null;


let startTime; 
let bytesTransferred; 


peer.on('open', (id) => {
    myIdDisplay.textContent = id;
});


copyButton.addEventListener('click', () => {
    const peerId = myIdDisplay.textContent;
    navigator.clipboard.writeText(peerId).then(() => {
        copyButton.textContent = '✅';
        setTimeout(() => {
            copyButton.textContent = '📋';
        }, 2000);
    }).catch(err => {
        alert('Failed to copy Peer ID.');
        console.error(err);
    });
});


peer.on('connection', (connection) => {
    if (conn && conn.open) {
        connection.on('open', () => {
            connection.send({ system: 'busy' });
            connection.close();
        });
        return;
    }
    conn = connection;
    setupConnection();
});


connectButton.addEventListener('click', () => {
    const peerId = peerIdInput.value.trim();
    if (peerId) {
        conn = peer.connect(peerId);
        conn.on('open', () => {
            setupConnection();
        });
        conn.on('error', (err) => {
            statusDisplay.textContent = `Status: Connection error - ${err}`;
        });
    } else {
        alert('Please enter a valid Peer ID.');
    }
});

function setupConnection() {
    statusDisplay.textContent = `Status: Connected to ${conn.peer}`;
    fileInput.disabled = false;
    sendButton.disabled = true;

    conn.on('data', (data) => {
        if (data.system === 'busy') {
            alert('Peer is busy or already connected.');
            return;
        }
        receiveFile(data);
    });

    conn.on('close', () => {
        statusDisplay.textContent = 'Status: Connection closed';
        fileInput.disabled = true;
        sendButton.disabled = true;
    });
}


fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        currentFile = file;
        selectedFileDisplay.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
        sendButton.disabled = false;
    } else {
        currentFile = null;
        selectedFileDisplay.textContent = 'No file selected.';
        sendButton.disabled = true;
    }
});


sendButton.addEventListener('click', () => {
    if (currentFile && conn && conn.open) {
        sendButton.disabled = true;
        fileInput.disabled = true;
        showModal('Sending file. Do not close or refresh.');

        
        startTime = Date.now(); 
        bytesTransferred = 0; 

        const reader = new FileReader();
        reader.onload = () => {
            const arrayBuffer = reader.result;
            const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
            let currentChunk = 0;

            function sendChunk() {
                const start = currentChunk * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
                const chunk = arrayBuffer.slice(start, end);
                bytesTransferred += chunk.byteLength; 

                
                const progress = Math.floor((bytesTransferred / currentFile.size) * 100);
                updateProgressBar(progress);
                percentageDisplay.textContent = `${progress}%`; 

                
                const elapsedTime = (Date.now() - startTime) / 1000; 
                const speed = bytesTransferred / elapsedTime; 
                speedDisplay.textContent = `Speed: ${formatSpeed(speed)}`; 

                
                const remainingBytes = currentFile.size - bytesTransferred; 
                const eta = speed > 0 ? (remainingBytes / speed) : 0; 
                etaDisplay.textContent = `Estimated Time: ${formatTime(eta)}`; 

                conn.send({
                    filename: currentFile.name,
                    filetype: currentFile.type,
                    filesize: currentFile.size,
                    filedata: chunk
                });
                currentChunk++;
                if (currentChunk < totalChunks) {
                    setTimeout(sendChunk, 50); 
                } else {
                    hideModal();
                    statusDisplay.textContent = `Status: Sent file "${currentFile.name}"`;
                    fileInput.disabled = false;
                    sendButton.disabled = true;
                }
            }

            sendChunk();
        };

        reader.readAsArrayBuffer(currentFile);
    } else {
        alert('No connection established or no file selected.');
    }
});


const CHUNK_SIZE = 16 * 1024; 


let receivedBuffers = [];
let expectedSize = 0;
let receivedSize = 0;
let fileName = '';
let receiveStartTime; 
let receiveBytesTransferred = 0; 

function receiveFile(data) {
    if (!data.filename || !data.filedata) {
        console.error('Invalid file data received.');
        return;
    }

    if (!fileName) {
        fileName = data.filename;
        expectedSize = data.filesize;
        showModal('Receiving file. Do not close or refresh.');

        
        receiveStartTime = Date.now(); 
        receiveBytesTransferred = 0; 
    }

    receivedBuffers.push(data.filedata);
    receivedSize += data.filedata.byteLength;
    receiveBytesTransferred += data.filedata.byteLength; 

    
    const progress = Math.floor((receivedSize / expectedSize) * 100);
    updateProgressBar(progress);
    percentageDisplay.textContent = `${progress}%`; 

    
    const elapsedTime = (Date.now() - receiveStartTime) / 1000; 
    const speed = receiveBytesTransferred / elapsedTime; 
    speedDisplay.textContent = `Speed: ${formatSpeed(speed)}`; 

    
    const remainingBytes = expectedSize - receivedSize; 
    const eta = speed > 0 ? (remainingBytes / speed) : 0; 
    etaDisplay.textContent = `Estimated Time: ${formatTime(eta)}`; 

    if (receivedSize >= expectedSize) {
        const blob = new Blob(receivedBuffers, { type: data.filetype });
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.download = fileName;
        downloadLink.style.display = 'block';
        downloadLink.textContent = `Download "${fileName}" (${formatFileSize(expectedSize)})`;
        statusDisplay.textContent = `Status: Received file "${fileName}"`;
        hideModal();

        
        receivedBuffers = [];
        expectedSize = 0;
        receivedSize = 0;
        fileName = '';
        receiveStartTime = 0; 
        receiveBytesTransferred = 0; 
    }
}


function formatFileSize(bytes) {
    if (bytes < 512 * 1024) { 
        return `${(bytes / 1024).toFixed(2)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) { 
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
}


function formatSpeed(bytesPerSecond) { 
    if (bytesPerSecond < 1024) {
        return `${bytesPerSecond.toFixed(2)} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
        return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
    } else {
        return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
    }
}


function formatTime(seconds) { 
    seconds = Math.ceil(seconds);
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
        return `${hrs}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
        return `${mins}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}


function showModal(message) {
    modalMessage.textContent = message;
    progressBar.style.width = '0%';
    modal.style.display = 'flex';
    percentageDisplay.textContent = '0%'; 
    speedDisplay.textContent = 'Speed: 0 KB/s'; 
    etaDisplay.textContent = 'Estimated Time: 0s'; 
}

function hideModal() {
    modal.style.display = 'none';
}

function updateProgressBar(percent) {
    progressBar.style.width = `${percent}%`;
}


window.addEventListener('click', (event) => {
    if (event.target === modal) {
        
        event.preventDefault();
    }
});


downloadLink.addEventListener('click', () => {
    setTimeout(() => {
        downloadLink.style.display = 'none';
        downloadLink.href = '#';
        downloadLink.textContent = 'Download Received File';
    }, 1000);
});
