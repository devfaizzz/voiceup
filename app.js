// Socket.IO connection for real-time updates
let socket;
if (typeof io !== 'undefined') {
  socket = io();
  
  // Listen for issue status updates
  socket.on('issue:status', (data) => {
    const statusType = {
      'approved': 'success',
      'rejected': 'error', 
      'on-hold': 'warning',
      'in-progress': 'info',
      'resolved': 'success'
    }[data.status] || 'info';
    
    const issueTitle = data.title || 'Your issue';
    const statusMessage = `Your "${issueTitle}" report has been ${data.status}`;
    
    showNotification(data.message || statusMessage, statusType);
    loadMyReports(); // Refresh reports
  });
  
  // Listen for general issue updates
  socket.on('issue:updated', (data) => {
    const issueTitle = data.title || 'Issue';
    const updateMessage = `"${issueTitle}" status updated to ${data.status}`;
    
    showNotification(data.message || updateMessage, 'info');
    loadMyReports(); // Refresh reports
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // Notification system - Define functions first
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `p-4 mb-2 rounded-lg border-l-4 ${
      type === 'success' ? 'bg-green-50 border-green-400 text-green-700' :
      type === 'error' ? 'bg-red-50 border-red-400 text-red-700' :
      type === 'warning' ? 'bg-yellow-50 border-yellow-400 text-yellow-700' :
      'bg-blue-50 border-blue-400 text-blue-700'
    }`;
    
    const statusIcon = {
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'info': 'ℹ️'
    }[type] || 'ℹ️';
    
    notification.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <p class="font-medium">${statusIcon} ${message}</p>
          <p class="text-xs mt-1">${new Date().toLocaleString()}</p>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>
    `;
    
    const notificationsList = document.getElementById('notificationsList');
    if (notificationsList) {
      notificationsList.insertBefore(notification, notificationsList.firstChild);
      
      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 10000);
    }
    
    // Also show toast
    showToast(message, type);
  }
  
  function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (toast && toastMessage) {
      toast.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        type === 'warning' ? 'bg-yellow-500' :
        'bg-blue-500'
      } text-white`;
      
      toastMessage.textContent = message;
      toast.classList.remove('hidden');
      
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 5000);
    }
  }
  
  // Geolocation
  const getLocationBtn = document.getElementById('getLocation');
  if (getLocationBtn) {
    getLocationBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showNotification('Geolocation not supported by this browser', 'error');
        return;
      }
      
      // Show loading state
      getLocationBtn.textContent = '📍 Getting Location...';
      getLocationBtn.disabled = true;
      
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        document.getElementById('latitude').value = latitude;
        document.getElementById('longitude').value = longitude;
        document.getElementById('locationAddress').textContent = `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`;
        
        // Reset button
        getLocationBtn.textContent = '📍 Location Set!';
        getLocationBtn.disabled = false;
        
        showNotification('Location captured successfully!', 'success');
        
        // Reset button text after 2 seconds
        setTimeout(() => {
          getLocationBtn.textContent = '📍 Get Current Location';
        }, 2000);
      }, (err) => {
        console.error('Location error:', err);
        showNotification(`Location error: ${err.message}`, 'error');
        
        // Reset button
        getLocationBtn.textContent = '📍 Get Current Location';
        getLocationBtn.disabled = false;
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
  }
  
  // Form submission handler
  const issueForm = document.getElementById('issueForm');
  if (issueForm) {
    issueForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Validate required fields
      const title = document.getElementById('title').value.trim();
      const description = document.getElementById('description').value.trim();
      const category = document.getElementById('category').value;
      const latitude = document.getElementById('latitude').value;
      const longitude = document.getElementById('longitude').value;
      const priority = (document.querySelector('input[name="priority"]:checked')||{}).value;
      
      if (!title || !description || !category || !latitude || !longitude) {
        showNotification('Please fill in all required fields and set your location', 'error');
        return;
      }
      
      const body = {
        title,
        description,
        category,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        priority: priority || 'medium',
        address: document.getElementById('locationAddress').textContent
      };
      
      try {
        const res = await fetch('/api/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const json = await res.json();
        
        if (res.ok) {
          showNotification('Report submitted successfully! You will be notified of status updates.', 'success');
          issueForm.reset();
          document.getElementById('imagePreview').innerHTML = '';
          document.getElementById('locationAddress').textContent = '';
          document.getElementById('latitude').value = '';
          document.getElementById('longitude').value = '';
          loadMyReports();
        } else {
          showNotification(`Failed to submit report: ${json.message || 'Unknown error'}`, 'error');
        }
      } catch (error) {
        console.error('Submission error:', error);
        showNotification('Network error. Please try again.', 'error');
      }
    });
  }
  
  // Load reports function
  async function loadMyReports() {
    const list = document.getElementById('reportsList');
    if (!list) return;
    
    try {
      // For now, load from public as anonymous; in auth flow we will call /api/issues/my-issues
      const res = await fetch('/api/issues/public');
      const data = await res.json();
      list.innerHTML = '';
      
      if (!data.issues || data.issues.length === 0) {
        list.innerHTML = '<div class="text-center py-8 text-gray-500">No reports found</div>';
        return;
      }
      
      (data.issues || []).slice(0, 10).forEach(issue => {
        const div = document.createElement('div');
        div.className = 'p-4 border rounded-lg hover:shadow-md transition-shadow';
        
        const statusColor = {
          'pending': 'text-yellow-600 bg-yellow-100',
          'approved': 'text-green-600 bg-green-100',
          'rejected': 'text-red-600 bg-red-100',
          'on-hold': 'text-gray-600 bg-gray-100',
          'in-progress': 'text-blue-600 bg-blue-100',
          'resolved': 'text-purple-600 bg-purple-100'
        }[issue.status] || 'text-gray-600 bg-gray-100';
        
        const priorityColor = {
          'low': 'text-green-600',
          'medium': 'text-yellow-600',
          'high': 'text-red-600'
        }[issue.priority] || 'text-gray-600';
        
        div.innerHTML = `
          <div class="flex justify-between items-start mb-2">
            <div class="font-semibold text-gray-800">${issue.title}</div>
            <span class="px-2 py-1 rounded-full text-xs ${statusColor}">${issue.status}</span>
          </div>
          <div class="text-sm text-gray-600 mb-2">
            <span class="inline-block mr-3">🏷️ ${issue.category}</span>
            <span class="inline-block mr-3 ${priorityColor}">⚠️ ${issue.priority} priority</span>
          </div>
          <div class="text-sm text-gray-500">
            <div>📍 ${issue.location?.address || 'Location not specified'}</div>
            <div class="mt-1">🗺️ ${new Date(issue.createdAt).toLocaleDateString()}</div>
          </div>
        `;
        
        list.appendChild(div);
      });
    } catch (error) {
      console.error('Error loading reports:', error);
      list.innerHTML = '<div class="text-center py-8 text-red-500">Failed to load reports</div>';
    }
  }
  loadMyReports();

  // Audio recording
  let mediaRecorder, audioChunks = [], currentStream = null;
  const startBtn = document.getElementById('startRecord');
  const stopBtn = document.getElementById('stopRecord');
  const audioPlayback = document.getElementById('audioPlayback');
  
  if (startBtn && stopBtn && audioPlayback) {
    startBtn.addEventListener('click', async () => {
      try {
        // Request microphone access
        currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        
        // Create MediaRecorder with better options
        const options = {
          mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 
                   MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 
                   MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/wav'
        };
        
        mediaRecorder = new MediaRecorder(currentStream, options);
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          // Stop all tracks to release microphone
          if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
          }
          
          // Create blob and URL for playback
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const blob = new Blob(audioChunks, { type: mimeType });
          const audioUrl = URL.createObjectURL(blob);
          
          // Set up audio playback
          audioPlayback.src = audioUrl;
          audioPlayback.classList.remove('hidden');
          audioPlayback.controls = true;
          
          // Add visual feedback
          showNotification('Audio recorded successfully! You can now play it back.', 'success');
          
          // Clean up old URL when new recording starts
          audioPlayback.addEventListener('loadstart', () => {
            URL.revokeObjectURL(audioUrl);
          }, { once: true });
        };
        
        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event.error);
          showNotification('Recording error: ' + event.error.message, 'error');
          resetRecordingUI();
        };
        
        // Start recording
        mediaRecorder.start(1000); // Collect data every second
        
        // Update UI
        startBtn.textContent = '🔴 Recording...';
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        
        showNotification('Recording started. Click stop when finished.', 'info');
        
      } catch (error) {
        console.error('Microphone access error:', error);
        showNotification('Microphone access denied or not available: ' + error.message, 'error');
        resetRecordingUI();
      }
    });
    
    stopBtn.addEventListener('click', () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      resetRecordingUI();
    });
    
    function resetRecordingUI() {
      startBtn.textContent = 'Start Recording';
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      
      // Clean up stream if still active
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
      }
    }
  }
});


