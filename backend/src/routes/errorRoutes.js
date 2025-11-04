const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Error storage file path
const ERROR_LOG_FILE = path.join(__dirname, '../../logs/errors.json');
const FEEDBACK_LOG_FILE = path.join(__dirname, '../../logs/feedback.json');

// Ensure log directory exists
const ensureLogDirectory = async () => {
  const logDir = path.dirname(ERROR_LOG_FILE);
  try {
    await fs.access(logDir);
  } catch {
    await fs.mkdir(logDir, { recursive: true });
  }
};

// Helper function to read JSON file
const readJsonFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    
    // Validate JSON before parsing
    if (!data.trim()) {
      return [];
    }
    
    const parsed = JSON.parse(data);
    
    // Ensure we return an array
    if (!Array.isArray(parsed)) {
      console.warn(`JSON file ${filePath} does not contain an array, resetting to empty array`);
      return [];
    }
    
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    
    // Handle JSON parsing errors by backing up corrupted file and starting fresh
    if (error instanceof SyntaxError) {
      console.error(`JSON parsing error in ${filePath}:`, error.message);
      
      // Create backup of corrupted file
      const backupPath = `${filePath}.corrupted.${Date.now()}`;
      try {
        await fs.copyFile(filePath, backupPath);
        console.log(`Corrupted file backed up to: ${backupPath}`);
      } catch (backupError) {
        console.error('Failed to backup corrupted file:', backupError);
      }
      
      // Return empty array to start fresh
      return [];
    }
    
    throw error;
  }
};

// Helper function to write JSON file atomically
const writeJsonFile = async (filePath, data) => {
  await ensureLogDirectory();
  
  // Validate data is an array
  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }
  
  // Use atomic write by writing to temporary file first
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  
  try {
    // Write to temporary file
    const jsonString = JSON.stringify(data, null, 2);
    
    // Validate the JSON string can be parsed back
    JSON.parse(jsonString);
    
    await fs.writeFile(tempPath, jsonString, 'utf8');
    
    // Atomically move temp file to final location
    await fs.rename(tempPath, filePath);
    
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
};

// POST /api/errors - Report a new error
router.post('/', async (req, res) => {
  try {
    const errorReport = {
      id: crypto.randomUUID(),
      ...req.body,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      serverTimestamp: new Date().toISOString()
    };

    // Validate required fields
    if (!errorReport.message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    // Read existing errors
    const errors = await readJsonFile(ERROR_LOG_FILE);
    
    // Add new error
    errors.push(errorReport);
    
    // Keep only the last 1000 errors to prevent file bloat
    if (errors.length > 1000) {
      errors.splice(0, errors.length - 1000);
    }
    
    // Save to file
    await writeJsonFile(ERROR_LOG_FILE, errors);
    
    // Log to console for immediate visibility
    console.error('Error reported:', {
      id: errorReport.id,
      message: errorReport.message,
      statusCode: errorReport.statusCode,
      severity: errorReport.severity,
      url: errorReport.url
    });
    
    // Send notification for critical errors
    if (errorReport.severity === 'critical') {
      // Here you could integrate with notification services like Slack, email, etc.
      console.error('🚨 CRITICAL ERROR REPORTED:', errorReport.message);
    }
    
    res.status(201).json({
      success: true,
      errorId: errorReport.id,
      message: 'Error report received'
    });
    
  } catch (error) {
    console.error('Failed to save error report:', error);
    res.status(500).json({
      error: 'Failed to save error report',
      details: error.message
    });
  }
});

// GET /api/errors - Get error reports (with pagination)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, severity, statusCode, resolved } = req.query;
    
    const errors = await readJsonFile(ERROR_LOG_FILE);
    
    // Apply filters
    let filteredErrors = errors;
    
    if (severity) {
      filteredErrors = filteredErrors.filter(e => e.severity === severity);
    }
    
    if (statusCode) {
      filteredErrors = filteredErrors.filter(e => e.statusCode === parseInt(statusCode));
    }
    
    if (resolved !== undefined) {
      const isResolved = resolved === 'true';
      filteredErrors = filteredErrors.filter(e => e.resolved === isResolved);
    }
    
    // Sort by timestamp (newest first)
    filteredErrors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedErrors = filteredErrors.slice(startIndex, endIndex);
    
    res.json({
      errors: paginatedErrors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredErrors.length,
        totalPages: Math.ceil(filteredErrors.length / limit)
      }
    });
    
  } catch (error) {
    console.error('Failed to retrieve errors:', error);
    res.status(500).json({
      error: 'Failed to retrieve errors',
      details: error.message
    });
  }
});

// GET /api/errors/metrics - Get error metrics
router.get('/metrics', async (req, res) => {
  try {
    const errors = await readJsonFile(ERROR_LOG_FILE);
    
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentErrors = errors.filter(e => new Date(e.timestamp) >= last30Days);
    const last24HourErrors = errors.filter(e => new Date(e.timestamp) >= last24Hours);
    const last7DayErrors = errors.filter(e => new Date(e.timestamp) >= last7Days);
    
    // Group by status code
    const errorsByStatus = {};
    recentErrors.forEach(error => {
      if (error.statusCode) {
        errorsByStatus[error.statusCode] = (errorsByStatus[error.statusCode] || 0) + 1;
      }
    });
    
    // Group by severity
    const errorsBySeverity = {};
    recentErrors.forEach(error => {
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });
    
    // Group by component
    const errorsByComponent = {};
    recentErrors.forEach(error => {
      if (error.component) {
        errorsByComponent[error.component] = (errorsByComponent[error.component] || 0) + 1;
      }
    });
    
    // Daily trends for last 7 days
    const dailyTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const count = errors.filter(e => 
        e.timestamp.split('T')[0] === dateStr
      ).length;
      dailyTrends.push({ date: dateStr, count });
    }
    
    res.json({
      totalErrors: errors.length,
      recentErrors: recentErrors.length,
      last24Hours: last24HourErrors.length,
      last7Days: last7DayErrors.length,
      errorsByStatus,
      errorsBySeverity,
      errorsByComponent,
      dailyTrends,
      resolutionRate: errors.length > 0 
        ? Math.round((errors.filter(e => e.resolved).length / errors.length) * 100)
        : 0
    });
    
  } catch (error) {
    console.error('Failed to calculate metrics:', error);
    res.status(500).json({
      error: 'Failed to calculate metrics',
      details: error.message
    });
  }
});

// PUT /api/errors/:id/resolve - Mark error as resolved
router.put('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;
    
    const errors = await readJsonFile(ERROR_LOG_FILE);
    const errorIndex = errors.findIndex(e => e.id === id);
    
    if (errorIndex === -1) {
      return res.status(404).json({
        error: 'Error not found'
      });
    }
    
    errors[errorIndex].resolved = true;
    errors[errorIndex].resolvedAt = new Date().toISOString();
    errors[errorIndex].resolution = resolution;
    
    await writeJsonFile(ERROR_LOG_FILE, errors);
    
    res.json({
      success: true,
      message: 'Error marked as resolved'
    });
    
  } catch (error) {
    console.error('Failed to resolve error:', error);
    res.status(500).json({
      error: 'Failed to resolve error',
      details: error.message
    });
  }
});

// POST /api/errors/:id/feedback - Add feedback to an error
router.post('/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;
    
    if (!feedback) {
      return res.status(400).json({
        error: 'Feedback is required'
      });
    }
    
    const errors = await readJsonFile(ERROR_LOG_FILE);
    const errorIndex = errors.findIndex(e => e.id === id);
    
    if (errorIndex === -1) {
      return res.status(404).json({
        error: 'Error not found'
      });
    }
    
    errors[errorIndex].userFeedback = feedback;
    errors[errorIndex].feedbackTimestamp = new Date().toISOString();
    
    await writeJsonFile(ERROR_LOG_FILE, errors);
    
    res.json({
      success: true,
      message: 'Feedback added successfully'
    });
    
  } catch (error) {
    console.error('Failed to add feedback:', error);
    res.status(500).json({
      error: 'Failed to add feedback',
      details: error.message
    });
  }
});

// POST /api/feedback - Submit general feedback
router.post('/feedback', async (req, res) => {
  try {
    const feedbackReport = {
      ...req.body,
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    // Read existing feedback
    const feedback = await readJsonFile(FEEDBACK_LOG_FILE);
    
    // Add new feedback
    feedback.push(feedbackReport);
    
    // Keep only the last 500 feedback entries
    if (feedback.length > 500) {
      feedback.splice(0, feedback.length - 500);
    }
    
    // Save to file
    await writeJsonFile(FEEDBACK_LOG_FILE, feedback);
    
    console.log('Feedback received:', {
      id: feedbackReport.id,
      severity: feedbackReport.severity,
      description: feedbackReport.description?.substring(0, 100) + '...'
    });
    
    res.status(201).json({
      success: true,
      feedbackId: feedbackReport.id,
      message: 'Feedback received successfully'
    });
    
  } catch (error) {
    console.error('Failed to save feedback:', error);
    res.status(500).json({
      error: 'Failed to save feedback',
      details: error.message
    });
  }
});

// DELETE /api/errors - Clear all errors (admin only)
router.delete('/', async (req, res) => {
  try {
    await writeJsonFile(ERROR_LOG_FILE, []);
    
    res.json({
      success: true,
      message: 'All errors cleared'
    });
    
  } catch (error) {
    console.error('Failed to clear errors:', error);
    res.status(500).json({
      error: 'Failed to clear errors',
      details: error.message
    });
  }
});

module.exports = router;