
document.addEventListener('DOMContentLoaded', function() {
    const evaluationForm = document.getElementById('evaluationForm');
    const loadingSection = document.getElementById('loadingSection');
    const resultsSection = document.getElementById('resultsSection');
    const alertContainer = document.getElementById('alertContainer');
    const evaluateBtn = document.getElementById('evaluateBtn');

    // Form submission handler
    evaluationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleFormSubmission();
    });

    // File input change handlers for validation
    document.getElementById('questionFile').addEventListener('change', validateFiles);
    document.getElementById('studentFiles').addEventListener('change', validateFiles);

    /**
     * Handle form submission and file upload
     */
    async function handleFormSubmission() {
        try {
            // Validate form
            if (!validateForm()) {
                return;
            }

            // Show loading state
            showLoading();
            clearAlerts();

            // Prepare form data
            const formData = new FormData(evaluationForm);

            // Add checkbox values
            formData.set('use_openai', document.getElementById('useOpenAI').checked);
            formData.set('use_vision', document.getElementById('useVision').checked);

            // Submit to backend
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.success) {
                displayResults(result);
                showAlert('Evaluation completed successfully!', 'success');
            } else {
                throw new Error(result.error || 'Evaluation failed');
            }

        } catch (error) {
            console.error('Evaluation error:', error);
            showAlert(`Error: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Validate form inputs
     */
    function validateForm() {
        const questionFile = document.getElementById('questionFile').files[0];
        const studentFiles = document.getElementById('studentFiles').files;

        if (!questionFile) {
            showAlert('Please select a question file.', 'error');
            return false;
        }

        if (studentFiles.length === 0) {
            showAlert('Please select at least one student answer file.', 'error');
            return false;
        }

        // Validate file types
        const validQuestionTypes = ['application/pdf', 'text/plain'];
        if (!validQuestionTypes.includes(questionFile.type)) {
            showAlert('Question file must be PDF or TXT format.', 'error');
            return false;
        }

        for (let file of studentFiles) {
            if (file.type !== 'application/pdf') {
                showAlert('All student files must be PDF format.', 'error');
                return false;
            }
        }

        // Validate file sizes (50MB limit)
        const maxSize = 50 * 1024 * 1024; // 50MB in bytes
        
        if (questionFile.size > maxSize) {
            showAlert('Question file is too large. Maximum size is 50MB.', 'error');
            return false;
        }

        for (let file of studentFiles) {
            if (file.size > maxSize) {
                showAlert(`File ${file.name} is too large. Maximum size is 50MB.`, 'error');
                return false;
            }
        }

        return true;
    }

    /**
     * Validate files and show feedback
     */
    function validateFiles() {
        const questionFile = document.getElementById('questionFile');
        const studentFiles = document.getElementById('studentFiles');
        
        // Update file input labels with selected file info
        if (questionFile.files.length > 0) {
            const file = questionFile.files[0];
            updateFileInfo(questionFile, `${file.name} (${formatFileSize(file.size)})`);
        }

        if (studentFiles.files.length > 0) {
            const fileCount = studentFiles.files.length;
            const totalSize = Array.from(studentFiles.files).reduce((sum, file) => sum + file.size, 0);
            updateFileInfo(studentFiles, `${fileCount} files selected (${formatFileSize(totalSize)} total)`);
        }

        // Enable/disable submit button
        const canSubmit = questionFile.files.length > 0 && studentFiles.files.length > 0;
        evaluateBtn.disabled = !canSubmit;
    }

    /**
     * Update file input information display
     */
    function updateFileInfo(input, info) {
        let infoElement = input.parentElement.querySelector('.file-info');
        if (!infoElement) {
            infoElement = document.createElement('div');
            infoElement.className = 'file-info';
            infoElement.style.cssText = 'margin-top: 5px; font-size: 0.85rem; color: #28a745; font-weight: 500;';
            input.parentElement.appendChild(infoElement);
        }
        infoElement.textContent = info;
    }

    /**
     * Display evaluation results
     */
    function displayResults(data) {
        // Show results section
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });

        // Display summary statistics
        displaySummaryStats(data.summary);

        // Display detailed results table
        displayResultsTable(data.results);

        // Display plagiarism results
        displayPlagiarismResults(data.plagiarism);

        // Display download link
        displayDownloadLink(data.report_filename);
    }

    /**
     * Display summary statistics
     */
    function displaySummaryStats(summary) {
        const statsContainer = document.getElementById('summaryStats');
        
        const stats = [
            {
                number: summary.total_students,
                label: 'Total Students',
                class: 'info'
            },
            {
                number: summary.passed,
                label: 'Passed',
                class: 'pass'
            },
            {
                number: summary.failed,
                label: 'Failed',
                class: 'fail'
            },
            {
                number: summary.plagiarism_cases,
                label: 'Plagiarism Cases',
                class: summary.plagiarism_cases > 0 ? 'warning' : 'pass'
            }
        ];

        statsContainer.innerHTML = stats.map(stat => `
            <div class="stat-card">
                <div class="stat-number ${stat.class}">${stat.number}</div>
                <div class="stat-label">${stat.label}</div>
            </div>
        `).join('');
    }

    /**
     * Display results table
     */
    function displayResultsTable(results) {
        const tableBody = document.getElementById('resultsTableBody');
        
        tableBody.innerHTML = results.map(result => `
            <tr>
                <td>
                    <strong>${result.student_id}</strong><br>
                    <small style="color: #666;">${result.filename}</small>
                </td>
                <td>
                    <strong>${(result.score * 100).toFixed(1)}%</strong>
                    ${result.metrics ? `
                        <br><small style="color: #666;">
                            TF-IDF: ${(result.metrics.tfidf_score * 100).toFixed(0)}% | 
                            SBERT: ${(result.metrics.sbert_score * 100).toFixed(0)}%
                        </small>
                    ` : ''}
                </td>
                <td>
                    <span class="grade-badge grade-${result.grade}">${result.grade}</span>
                </td>
                <td>
                    <span class="${result.score >= 0.6 ? 'pass' : 'fail'}">
                        ${result.score >= 0.6 ? '✓ Pass' : '✗ Fail'}
                    </span>
                </td>
                <td>
                    <div style="max-width: 300px; word-wrap: break-word;">
                        ${result.feedback || 'No feedback available'}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Display plagiarism detection results
     */
    function displayPlagiarismResults(plagiarismResults) {
        const plagiarismSection = document.getElementById('plagiarismSection');
        
        if (!plagiarismResults || plagiarismResults.length === 0) {
            plagiarismSection.innerHTML = `
                <h3>🛡️ Plagiarism Detection</h3>
                <div class="alert alert-success">
                    No plagiarism detected. All submissions appear to be original.
                </div>
            `;
            return;
        }

        const plagiarismCases = plagiarismResults.filter(result => result.is_plagiarism);
        
        let html = '<h3>🚨 Plagiarism Detection Results</h3>';
        
        if (plagiarismCases.length === 0) {
            html += `
                <div class="alert alert-success">
                    No significant plagiarism detected. Maximum similarity: ${Math.max(...plagiarismResults.map(r => r.combined_similarity * 100)).toFixed(1)}%
                </div>
            `;
        } else {
            html += `
                <div class="alert alert-error">
                    <strong>⚠️ ${plagiarismCases.length} potential plagiarism case(s) detected!</strong>
                </div>
            `;
            
            plagiarismCases.forEach(case_ => {
                const similarityPercent = (case_.combined_similarity * 100).toFixed(1);
                const isCritical = case_.severity === 'Critical';
                
                html += `
                    <div class="plagiarism-item ${isCritical ? 'plagiarism-critical' : ''}">
                        <strong>${case_.student_1} vs ${case_.student_2}</strong>
                        <div style="margin-top: 8px;">
                            <span style="font-weight: 600;">Similarity: ${similarityPercent}%</span>
                            <span style="margin-left: 15px; color: ${isCritical ? '#dc3545' : '#ffc107'};">
                                ${case_.severity} Risk
                            </span>
                        </div>
                        ${case_.common_phrases && case_.common_phrases.length > 0 ? `
                            <div style="margin-top: 10px; font-size: 0.9rem; color: #666;">
                                <strong>Common phrases:</strong> ${case_.common_phrases.slice(0, 3).join(', ')}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        }

        plagiarismSection.innerHTML = html;
    }

    /**
     * Display download link for the report
     */
    function displayDownloadLink(reportFilename) {
        const downloadSection = document.getElementById('downloadSection');
        
        if (reportFilename) {
            const downloadLink = `
                <a href="/download-report/${reportFilename}" class="download-btn" target="_blank">
                    📊 Download Excel Report
                </a>
                <br><br>
                <small style="color: #666;">
                    Report includes detailed metrics, analytics, and personalized feedback for each student.
                </small>
            `;
            downloadSection.innerHTML = downloadSection.innerHTML.replace(
                /<!-- Download link will be populated here -->/,
                downloadLink
            );
        }
    }

    /**
     * Show loading state
     */
    function showLoading() {
        loadingSection.style.display = 'block';
        evaluateBtn.disabled = true;
        resultsSection.style.display = 'none';
    }

    /**
     * Hide loading state
     */
    function hideLoading() {
        loadingSection.style.display = 'none';
        evaluateBtn.disabled = false;
    }

    /**
     * Show alert message
     */
    function showAlert(message, type = 'info') {
        const alertClass = type === 'error' ? 'alert-error' : 'alert-success';
        const alertHtml = `
            <div class="alert ${alertClass}">
                ${message}
                <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 1.2rem; cursor: pointer;">×</button>
            </div>
        `;
        
        alertContainer.innerHTML = alertHtml;
        alertContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Clear all alert messages
     */
    function clearAlerts() {
        alertContainer.innerHTML = '';
    }

    /**
     * Format file size for display
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Initialize tooltips and additional UI enhancements
     */
    function initializeUI() {
        // Add drag and drop functionality
        const fileInputs = document.querySelectorAll('.file-input');
        
        fileInputs.forEach(input => {
            const container = input.parentElement;
            
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                container.addEventListener(eventName, preventDefaults, false);
            });
            
            ['dragenter', 'dragover'].forEach(eventName => {
                container.addEventListener(eventName, highlight, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                container.addEventListener(eventName, unhighlight, false);
            });
            
            container.addEventListener('drop', handleDrop, false);
            
            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            function highlight(e) {
                container.classList.add('drag-highlight');
            }
            
            function unhighlight(e) {
                container.classList.remove('drag-highlight');
            }
            
            function handleDrop(e) {
                const dt = e.dataTransfer;
                const files = dt.files;
                input.files = files;
                validateFiles();
            }
        });
        
        // Add CSS for drag and drop highlight
        const style = document.createElement('style');
        style.textContent = `
            .drag-highlight {
                border-color: #4472C4 !important;
                background-color: #f0f4f8 !important;
                transform: scale(1.02);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Health check to verify backend connectivity
     */
    async function healthCheck() {
        try {
            const response = await fetch('/health');
            const health = await response.json();
            
            if (health.status === 'healthy') {
                console.log('✅ Backend connection healthy');
                console.log('Features available:', health.features);
            }
        } catch (error) {
            console.warn('⚠️ Backend health check failed:', error);
            showAlert('Warning: Unable to connect to backend. Some features may be unavailable.', 'error');
        }
    }

    // Initialize UI enhancements
    initializeUI();
    
    // Perform health check
    healthCheck();
    
    // Initial file validation
    validateFiles();
});