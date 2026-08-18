
// COMPLETE API ENDPOINTS FOR NEED AND PLEDGE SYSTEM
// This file contains all the server-side API endpoints needed to replicate the system

import express from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

// Import your database storage layer and schemas
// import { storage } from './storage';
// import { insertNeedSchema, insertPledgeSchema, NeedStatus } from './schema';

const router = express.Router();

// ========== NEED MANAGEMENT ENDPOINTS ==========

// GET /api/needs - Get all needs
router.get('/needs', async (req, res) => {
  try {
    const needs = await storage.getAllNeeds();
    res.json(needs);
  } catch (error) {
    console.error('Error getting needs:', error);
    res.status(500).json({ message: 'Failed to retrieve needs' });
  }
});

// GET /api/needs/:id - Get a single need by ID
router.get('/needs/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid need ID' });
    }

    const need = await storage.getNeed(id);
    if (!need) {
      return res.status(404).json({ message: 'Need not found' });
    }

    res.json(need);
  } catch (error) {
    console.error('Error getting need:', error);
    res.status(500).json({ message: 'Failed to retrieve need' });
  }
});

// POST /api/needs - Create a new need
router.post('/needs', async (req, res) => {
  try {
    // Authentication check - implement your auth middleware
    // if (!req.isAuthenticated() || !req.user.isAdmin) {
    //   return res.status(403).json({ message: 'Not authorized' });
    // }
    
    console.log('POST /api/needs - Request Body:', JSON.stringify({
      title: req.body.title,
      recipientName: req.body.recipientName,
      recipientPhone: req.body.recipientPhone,
      recipientEmail: req.body.recipientEmail,
      recipientAddress: req.body.recipientAddress,
      recipientNotes: req.body.recipientNotes
    }, null, 2));

    const result = insertNeedSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: 'Invalid need data', 
        errors: fromZodError(result.error)
      });
    }

    // Check if a status was specified for creating draft needs
    const status = req.body.status ? req.body.status : undefined;
    const need = await storage.createNeed(result.data, status);
    res.status(201).json(need);
  } catch (error) {
    console.error('Error creating need:', error);
    res.status(500).json({ message: 'Failed to create need' });
  }
});

// PUT /api/needs/:id - Update a need
router.put('/needs/:id', async (req, res) => {
  try {
    // Authentication check
    // if (!req.isAuthenticated() || !req.user.isAdmin) {
    //   return res.status(403).json({ message: 'Not authorized' });
    // }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid need ID' });
    }

    // Check if need exists
    const existingNeed = await storage.getNeed(id);
    if (!existingNeed) {
      return res.status(404).json({ message: 'Need not found' });
    }

    console.log('PUT /api/needs/:id - Request Body:', JSON.stringify({
      title: req.body.title,
      recipientName: req.body.recipientName,
      recipientPhone: req.body.recipientPhone,
      recipientEmail: req.body.recipientEmail,
      recipientAddress: req.body.recipientAddress,
      recipientNotes: req.body.recipientNotes
    }, null, 2));

    // Validate request data
    const result = insertNeedSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: 'Invalid need data', 
        errors: fromZodError(result.error)
      });
    }

    // Update the need with validated data
    const updatedNeed = await storage.updateNeed(id, result.data);
    res.json(updatedNeed);
  } catch (error) {
    console.error('Error updating need:', error);
    res.status(500).json({ message: 'Failed to update need' });
  }
});

// PATCH /api/needs/:id/status - Update need status
router.patch('/needs/:id/status', async (req, res) => {
  try {
    // Authentication check
    // if (!req.isAuthenticated() || !req.user.isAdmin) {
    //   return res.status(403).json({ message: 'Not authorized' });
    // }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid need ID' });
    }

    const { status } = req.body;
    if (!Object.values(NeedStatus).includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Get the need before update to check its current status
    const existingNeed = await storage.getNeed(id);
    if (!existingNeed) {
      return res.status(404).json({ message: 'Need not found' });
    }
    
    // Update need status
    const updatedNeed = await storage.updateNeedStatus(id, status);
    if (!updatedNeed) {
      return res.status(404).json({ message: 'Failed to update need status' });
    }
    
    // Handle email notifications if status changed from FLOATING to PLEDGED
    if (existingNeed.status === NeedStatus.FLOATING && status === NeedStatus.PLEDGED) {
      try {
        // Get the latest pledges for this need
        const pledges = await storage.getPledgesByNeedId(id);
        
        if (pledges.length > 0) {
          // Get the most recent pledge
          const latestPledge = pledges.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
          
          // Send email notifications here
          // await sendPledgeNotification(updatedNeed, latestPledge, adminEmails);
        }
      } catch (emailError) {
        console.error('Error sending notification email:', emailError);
      }
    }

    res.json(updatedNeed);
  } catch (error) {
    console.error('Error updating need status:', error);
    res.status(500).json({ message: 'Failed to update need status' });
  }
});

// PATCH /api/needs/:id/highlight - Toggle need highlighted status
router.patch('/needs/:id/highlight', async (req, res) => {
  try {
    // Authentication check
    // if (!req.isAuthenticated() || !req.user.isAdmin) {
    //   return res.status(403).json({ message: 'Not authorized' });
    // }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid need ID' });
    }

    // Get the need
    const existingNeed = await storage.getNeed(id);
    if (!existingNeed) {
      return res.status(404).json({ message: 'Need not found' });
    }
    
    // Toggle the highlighted status
    const isHighlighted = !existingNeed.isHighlighted;
    
    // Update the need with the new highlighted status
    const updatedNeed = await storage.updateNeed(id, { isHighlighted });
    
    if (!updatedNeed) {
      return res.status(500).json({ message: 'Failed to update need highlighted status' });
    }
    
    res.json(updatedNeed);
  } catch (error) {
    console.error('Error toggling need highlight status:', error);
    res.status(500).json({ message: 'Failed to update need highlighted status' });
  }
});

// DELETE /api/needs/:id - Delete a need
router.delete('/needs/:id', async (req, res) => {
  try {
    // Authentication check
    // if (!req.isAuthenticated() || !req.user.isAdmin) {
    //   return res.status(403).json({ message: 'Not authorized' });
    // }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid need ID' });
    }

    const success = await storage.deleteNeed(id);
    if (!success) {
      return res.status(404).json({ message: 'Need not found' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting need:', error);
    res.status(500).json({ message: 'Failed to delete need' });
  }
});

// POST /api/needs/:id/duplicate - Duplicate a need to draft
router.post('/needs/:id/duplicate', async (req, res) => {
  try {
    // Authentication check
    // if (!req.isAuthenticated() || !req.user.isAdmin) {
    //   return res.status(403).json({ message: 'Not authorized' });
    // }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid need ID' });
    }

    // Get the original need
    const originalNeed = await storage.getNeed(id);
    if (!originalNeed) {
      return res.status(404).json({ message: 'Need not found' });
    }

    // Create a new need based on the original, but with DRAFT status
    const { id: _, ...needData } = originalNeed;
    const newNeed = await storage.createNeed({
      ...needData,
      title: `${originalNeed.title} (Copy)`,
    }, NeedStatus.DRAFT);

    res.status(201).json(newNeed);
  } catch (error) {
    console.error('Error duplicating need:', error);
    res.status(500).json({ message: 'Failed to duplicate need' });
  }
});

// ========== PLEDGE MANAGEMENT ENDPOINTS ==========

// POST /api/pledges - Create a pledge
router.post('/pledges', async (req, res) => {
  try {
    const result = insertPledgeSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: 'Invalid pledge data', 
        errors: fromZodError(result.error)
      });
    }

    const need = await storage.getNeed(result.data.needId);
    if (!need) {
      return res.status(404).json({ message: 'Need not found' });
    }

    if (need.status !== NeedStatus.FLOATING && need.status !== NeedStatus.RECURRING) {
      return res.status(400).json({ 
        message: 'This need has already been pledged or fulfilled' 
      });
    }

    // Create the pledge
    const pledge = await storage.createPledge(result.data);
    
    try {
      // Send confirmation email to the donor
      // await sendPledgeConfirmation(need, pledge);
      console.log(`Confirmation email would be sent to: ${pledge.email}`);
      
      // If user opted in for email subscription, add them to mailing list
      if (pledge.subscribeToEmails) {
        try {
          // await addSubscriber(pledge.email, pledge.firstName, pledge.lastName);
          console.log(`Would add ${pledge.email} to mailing list`);
        } catch (subscribeError) {
          console.error('Error subscribing to mailing list:', subscribeError);
        }
      }
      
      // Only update status to PLEDGED for non-recurring needs
      if (need.status === NeedStatus.FLOATING) {
        const updatedNeed = await storage.updateNeedStatus(need.id, NeedStatus.PLEDGED);
        
        if (updatedNeed) {
          // Send notification email to admins
          // await sendPledgeNotification(updatedNeed, pledge, adminEmails);
          console.log('Pledge created, need status updated, and notification sent to admins');
        }
      } else if (need.status === NeedStatus.RECURRING) {
        // For recurring needs, don't change status but still send notification
        // await sendPledgeNotification(need, pledge, adminEmails);
        console.log('Recurring need pledge created and notification sent to admins');
      }
    } catch (error) {
      console.error('Error processing pledge:', error);
    }
    
    res.status(201).json(pledge);
  } catch (error) {
    console.error('Error creating pledge:', error);
    res.status(500).json({ message: 'Failed to create pledge' });
  }
});

// GET /api/needs/:id/pledges - Get pledges for a need
router.get('/needs/:id/pledges', async (req, res) => {
  try {
    // Authentication check
    // if (!req.isAuthenticated() || !req.user.isAdmin) {
    //   return res.status(403).json({ message: 'Not authorized' });
    // }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid need ID' });
    }

    // Set cache control headers to prevent caching of pledge data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const pledges = await storage.getPledgesByNeedId(id);
    console.log(`Fetched ${pledges.length} pledges for need ID ${id}`);
    res.json(pledges);
  } catch (error) {
    console.error('Error getting pledges:', error);
    res.status(500).json({ message: 'Failed to retrieve pledges' });
  }
});

// GET /api/all-pledges - Get all pledges grouped by need ID
router.get('/all-pledges', async (req, res) => {
  try {
    // Authentication check
    // if (!req.isAuthenticated() || !req.user.isAdmin) {
    //   return res.status(403).json({ message: 'Not authorized' });
    // }

    // Set cache control headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Get ALL needs to ensure we catch newly pledged needs
    const allNeeds = await storage.getAllNeeds();
    
    // Create a record to store pledges by need ID
    const pledgesByNeedId = {};
    
    // Check each need for pledges
    for (const need of allNeeds) {
      const pledges = await storage.getPledgesByNeedId(need.id);
      if (pledges.length > 0) {
        pledgesByNeedId[need.id] = pledges;
        console.log(`Found ${pledges.length} pledges for need ID ${need.id} (${need.title})`);
      }
    }
    
    res.json(pledgesByNeedId);
  } catch (error) {
    console.error('Error getting all pledges:', error);
    res.status(500).json({ message: 'Failed to retrieve all pledges' });
  }
});

// ========== IMAGE UPLOAD ENDPOINT ==========

// POST /api/upload/image - Upload image for needs
router.post('/upload/image', async (req, res) => {
  try {
    // Authentication check
    // if (!req.isAuthenticated() || !req.user.isAdmin) {
    //   return res.status(403).json({ message: 'Not authorized' });
    // }
    
    if (!req.body || !req.body.image) {
      return res.status(400).json({ message: 'No image data provided' });
    }
    
    // Extract the base64 data and file type
    const imageData = req.body.image;
    const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ message: 'Invalid image data format' });
    }
    
    const fileType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ 
        message: 'Invalid file type. Allowed types: JPEG, PNG, GIF, WebP' 
      });
    }
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Generate a unique filename
    const extension = fileType.split('/')[1];
    const filename = `${randomUUID()}.${extension}`;
    const filepath = path.join(uploadsDir, filename);
    
    // Write the file
    fs.writeFileSync(filepath, buffer);
    
    // Return the URL to access the file
    const fileUrl = `/uploads/${filename}`;
    res.status(201).json({ url: fileUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Failed to upload image' });
  }
});

// ========== FULFILLMENT ENDPOINT ==========

// POST /api/fulfill-need - Fulfill a need via secure token
router.post('/fulfill-need', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'No token provided' });
    }
    
    // Verify the token (implement your token verification logic)
    const { needId, action, valid } = verifySecureToken(token);
    
    if (!valid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired token. Please request a new one.' 
      });
    }
    
    // Process the action
    if (action === 'fulfill' && needId > 0) {
      const need = await storage.getNeed(needId);
      
      if (!need) {
        return res.status(404).json({ 
          success: false, 
          message: 'Need not found' 
        });
      }
      
      // Check if need is in proper state to be fulfilled
      if (need.status !== NeedStatus.PLEDGED && need.status !== NeedStatus.RECURRING) {
        return res.status(400).json({ 
          success: false, 
          message: `This need cannot be fulfilled because it is in ${need.status} state.`
        });
      }
      
      // Update the need to FULFILLED
      const updatedNeed = await storage.updateNeedStatus(needId, NeedStatus.FULFILLED);
      
      if (!updatedNeed) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to update need status' 
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Need successfully marked as fulfilled!',
        need: {
          id: updatedNeed.id,
          title: updatedNeed.title,
          category: updatedNeed.category,
          status: updatedNeed.status
        }
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid action specified in token' 
      });
    }
  } catch (error) {
    console.error('Error fulfilling need:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred while processing your request.' 
    });
  }
});

// Helper function for token verification (implement based on your security needs)
function verifySecureToken(token) {
  try {
    // Implement your token verification logic here
    // This should decode and validate the token
    // Return { needId, action, valid: boolean }
    return { needId: -1, action: '', valid: false };
  } catch (err) {
    console.error('Error verifying token:', err);
    return { needId: -1, action: '', valid: false };
  }
}

export default router;
