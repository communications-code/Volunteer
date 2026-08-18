
// COMPLETE DATABASE OPERATIONS FOR NEED AND PLEDGE SYSTEM
// This file contains all the database operations needed to replicate the system

import { eq, desc } from 'drizzle-orm';
// Import your database connection and schemas
// import { db } from './db';
// import { needs, pledges } from './schema';

class DatabaseStorage {
  // ========== NEED OPERATIONS ==========

  async createNeed(needData, status) {
    try {
      const needToInsert = {
        ...needData,
        status: status || 'FLOATING',
        estimatedCost: needData.estimatedCost || null,
        neededBy: needData.neededBy || null,
        startDate: needData.startDate || null,
        endDate: needData.endDate || null,
        eventDate: needData.eventDate || null,
        volunteersNeeded: needData.volunteersNeeded || null,
        volunteersCount: 0,
        isHighlighted: false,
        updatedAt: new Date(),
      };

      console.log('Creating need with data:', JSON.stringify({
        title: needToInsert.title,
        recipientName: needToInsert.recipientName,
        recipientPhone: needToInsert.recipientPhone,
        recipientEmail: needToInsert.recipientEmail,
        recipientAddress: needToInsert.recipientAddress,
        recipientNotes: needToInsert.recipientNotes
      }, null, 2));

      const [need] = await db.insert(needs).values(needToInsert).returning();
      console.log('Created need with ID:', need.id);
      return need;
    } catch (error) {
      console.error('Error in createNeed:', error);
      throw error;
    }
  }

  async getAllNeeds() {
    try {
      const allNeeds = await db.select().from(needs).orderBy(desc(needs.createdAt));
      console.log(`Retrieved ${allNeeds.length} needs from database`);
      return allNeeds;
    } catch (error) {
      console.error('Error in getAllNeeds:', error);
      throw error;
    }
  }

  async getNeed(id) {
    try {
      const [need] = await db.select().from(needs).where(eq(needs.id, id));
      
      if (need) {
        console.log('Retrieved need:', {
          id: need.id,
          title: need.title,
          status: need.status,
          recipientName: need.recipientName,
          recipientPhone: need.recipientPhone,
          recipientEmail: need.recipientEmail
        });
      }
      
      return need;
    } catch (error) {
      console.error('Error in getNeed:', error);
      throw error;
    }
  }

  async updateNeed(id, needData) {
    try {
      console.log('Updating need with ID:', id);
      console.log('Update data:', JSON.stringify({
        title: needData.title,
        recipientName: needData.recipientName,
        recipientPhone: needData.recipientPhone,
        recipientEmail: needData.recipientEmail,
        recipientAddress: needData.recipientAddress,
        recipientNotes: needData.recipientNotes
      }, null, 2));

      const [updatedNeed] = await db
        .update(needs)
        .set({ 
          ...needData, 
          updatedAt: new Date() 
        })
        .where(eq(needs.id, id))
        .returning();

      console.log('Updated need successfully');
      return updatedNeed;
    } catch (error) {
      console.error('Error in updateNeed:', error);
      throw error;
    }
  }

  async updateNeedStatus(id, status) {
    try {
      console.log(`Updating need ${id} status to: ${status}`);
      
      const [updatedNeed] = await db
        .update(needs)
        .set({ 
          status, 
          updatedAt: new Date() 
        })
        .where(eq(needs.id, id))
        .returning();

      if (updatedNeed) {
        console.log(`Successfully updated need ${id} status to ${status}`);
      }
      
      return updatedNeed;
    } catch (error) {
      console.error('Error in updateNeedStatus:', error);
      throw error;
    }
  }

  async deleteNeed(id) {
    try {
      console.log(`Deleting need with ID: ${id}`);
      
      const result = await db.delete(needs).where(eq(needs.id, id));
      const success = result.rowCount > 0;
      
      if (success) {
        console.log(`Successfully deleted need ${id}`);
      } else {
        console.log(`No need found with ID ${id} to delete`);
      }
      
      return success;
    } catch (error) {
      console.error('Error in deleteNeed:', error);
      throw error;
    }
  }

  async toggleNeedHighlight(id) {
    try {
      // Get current need to toggle highlight status
      const existingNeed = await this.getNeed(id);
      if (!existingNeed) {
        return null;
      }
      
      const isHighlighted = !existingNeed.isHighlighted;
      console.log(`Toggling need ${id} highlight status to: ${isHighlighted}`);
      
      const [updatedNeed] = await db
        .update(needs)
        .set({ 
          isHighlighted, 
          updatedAt: new Date() 
        })
        .where(eq(needs.id, id))
        .returning();
      
      return updatedNeed;
    } catch (error) {
      console.error('Error in toggleNeedHighlight:', error);
      throw error;
    }
  }

  async getNeedsByStatus(status) {
    try {
      const filteredNeeds = await db
        .select()
        .from(needs)
        .where(eq(needs.status, status))
        .orderBy(desc(needs.createdAt));
      
      console.log(`Retrieved ${filteredNeeds.length} needs with status: ${status}`);
      return filteredNeeds;
    } catch (error) {
      console.error('Error in getNeedsByStatus:', error);
      throw error;
    }
  }

  async getNeedsByCategory(category) {
    try {
      const categoryNeeds = await db
        .select()
        .from(needs)
        .where(eq(needs.category, category))
        .orderBy(desc(needs.createdAt));
      
      console.log(`Retrieved ${categoryNeeds.length} needs in category: ${category}`);
      return categoryNeeds;
    } catch (error) {
      console.error('Error in getNeedsByCategory:', error);
      throw error;
    }
  }

  // ========== PLEDGE OPERATIONS ==========

  async createPledge(pledgeData) {
    try {
      console.log('Creating pledge:', JSON.stringify({
        needId: pledgeData.needId,
        firstName: pledgeData.firstName,
        lastName: pledgeData.lastName,
        email: pledgeData.email,
        donationType: pledgeData.donationType,
        paymentCompleted: pledgeData.paymentCompleted
      }, null, 2));

      const [pledge] = await db.insert(pledges).values(pledgeData).returning();
      
      console.log(`Created pledge with ID: ${pledge.id} for need: ${pledge.needId}`);
      return pledge;
    } catch (error) {
      console.error('Error in createPledge:', error);
      throw error;
    }
  }

  async getPledge(id) {
    try {
      const [pledge] = await db.select().from(pledges).where(eq(pledges.id, id));
      
      if (pledge) {
        console.log('Retrieved pledge:', {
          id: pledge.id,
          needId: pledge.needId,
          firstName: pledge.firstName,
          lastName: pledge.lastName,
          email: pledge.email
        });
      }
      
      return pledge;
    } catch (error) {
      console.error('Error in getPledge:', error);
      throw error;
    }
  }

  async getPledgesByNeedId(needId) {
    try {
      const needPledges = await db
        .select()
        .from(pledges)
        .where(eq(pledges.needId, needId))
        .orderBy(desc(pledges.createdAt));
      
      console.log(`Retrieved ${needPledges.length} pledges for need ID: ${needId}`);
      return needPledges;
    } catch (error) {
      console.error('Error in getPledgesByNeedId:', error);
      throw error;
    }
  }

  async getAllPledges() {
    try {
      const allPledges = await db
        .select()
        .from(pledges)
        .orderBy(desc(pledges.createdAt));
      
      console.log(`Retrieved ${allPledges.length} total pledges from database`);
      return allPledges;
    } catch (error) {
      console.error('Error in getAllPledges:', error);
      throw error;
    }
  }

  async getPledgesByEmail(email) {
    try {
      const emailPledges = await db
        .select()
        .from(pledges)
        .where(eq(pledges.email, email))
        .orderBy(desc(pledges.createdAt));
      
      console.log(`Retrieved ${emailPledges.length} pledges for email: ${email}`);
      return emailPledges;
    } catch (error) {
      console.error('Error in getPledgesByEmail:', error);
      throw error;
    }
  }

  async updatePledgePaymentStatus(pledgeId, paymentCompleted) {
    try {
      console.log(`Updating pledge ${pledgeId} payment status to: ${paymentCompleted}`);
      
      const [updatedPledge] = await db
        .update(pledges)
        .set({ paymentCompleted })
        .where(eq(pledges.id, pledgeId))
        .returning();
      
      if (updatedPledge) {
        console.log(`Successfully updated pledge ${pledgeId} payment status`);
      }
      
      return updatedPledge;
    } catch (error) {
      console.error('Error in updatePledgePaymentStatus:', error);
      throw error;
    }
  }

  async deletePledge(id) {
    try {
      console.log(`Deleting pledge with ID: ${id}`);
      
      const result = await db.delete(pledges).where(eq(pledges.id, id));
      const success = result.rowCount > 0;
      
      if (success) {
        console.log(`Successfully deleted pledge ${id}`);
      } else {
        console.log(`No pledge found with ID ${id} to delete`);
      }
      
      return success;
    } catch (error) {
      console.error('Error in deletePledge:', error);
      throw error;
    }
  }

  // ========== AGGREGATED DATA OPERATIONS ==========

  async getNeedsWithPledgeCounts() {
    try {
      // Get all needs
      const allNeeds = await this.getAllNeeds();
      
      // Get pledge counts for each need
      const needsWithCounts = await Promise.all(
        allNeeds.map(async (need) => {
          const pledges = await this.getPledgesByNeedId(need.id);
          return {
            ...need,
            pledgeCount: pledges.length,
            pledges: pledges
          };
        })
      );
      
      console.log('Retrieved needs with pledge counts');
      return needsWithCounts;
    } catch (error) {
      console.error('Error in getNeedsWithPledgeCounts:', error);
      throw error;
    }
  }

  async getAllPledgesGroupedByNeed() {
    try {
      // Get ALL needs to ensure we catch newly pledged needs
      const allNeeds = await this.getAllNeeds();
      
      // Create a record to store pledges by need ID
      const pledgesByNeedId = {};
      
      // Check each need for pledges
      for (const need of allNeeds) {
        const pledges = await this.getPledgesByNeedId(need.id);
        if (pledges.length > 0) {
          pledgesByNeedId[need.id] = pledges;
          console.log(`Found ${pledges.length} pledges for need ID ${need.id} (${need.title})`);
        }
      }
      
      return pledgesByNeedId;
    } catch (error) {
      console.error('Error in getAllPledgesGroupedByNeed:', error);
      throw error;
    }
  }

  async getDashboardStats() {
    try {
      const allNeeds = await this.getAllNeeds();
      const allPledges = await this.getAllPledges();
      
      const stats = {
        totalNeeds: allNeeds.length,
        floatingNeeds: allNeeds.filter(need => need.status === 'FLOATING').length,
        pledgedNeeds: allNeeds.filter(need => need.status === 'PLEDGED').length,
        fulfilledNeeds: allNeeds.filter(need => need.status === 'FULFILLED').length,
        recurringNeeds: allNeeds.filter(need => need.status === 'RECURRING').length,
        draftNeeds: allNeeds.filter(need => need.status === 'DRAFT').length,
        totalPledges: allPledges.length,
        recentNeeds: allNeeds.slice(0, 5), // Most recent 5 needs
        recentPledges: allPledges.slice(0, 10) // Most recent 10 pledges
      };
      
      console.log('Generated dashboard stats:', {
        totalNeeds: stats.totalNeeds,
        totalPledges: stats.totalPledges
      });
      
      return stats;
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      throw error;
    }
  }

  // ========== SEARCH AND FILTER OPERATIONS ==========

  async searchNeeds(searchTerm) {
    try {
      // This would require implementing full-text search
      // For now, we'll do a simple title/description search
      const allNeeds = await this.getAllNeeds();
      
      const filteredNeeds = allNeeds.filter(need => 
        need.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        need.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      console.log(`Search for "${searchTerm}" returned ${filteredNeeds.length} results`);
      return filteredNeeds;
    } catch (error) {
      console.error('Error in searchNeeds:', error);
      throw error;
    }
  }

  async getFilteredNeeds(filters) {
    try {
      let filteredNeeds = await this.getAllNeeds();
      
      // Apply status filter
      if (filters.status && filters.status.length > 0) {
        filteredNeeds = filteredNeeds.filter(need => 
          filters.status.includes(need.status)
        );
      }
      
      // Apply category filter
      if (filters.category && filters.category.length > 0) {
        filteredNeeds = filteredNeeds.filter(need => 
          filters.category.includes(need.category)
        );
      }
      
      // Apply date range filter
      if (filters.startDate || filters.endDate) {
        filteredNeeds = filteredNeeds.filter(need => {
          const needDate = new Date(need.createdAt);
          let inRange = true;
          
          if (filters.startDate) {
            inRange = inRange && needDate >= new Date(filters.startDate);
          }
          
          if (filters.endDate) {
            inRange = inRange && needDate <= new Date(filters.endDate);
          }
          
          return inRange;
        });
      }
      
      console.log(`Applied filters returned ${filteredNeeds.length} needs`);
      return filteredNeeds;
    } catch (error) {
      console.error('Error in getFilteredNeeds:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const storage = new DatabaseStorage();
export { storage, DatabaseStorage };

// ADDITIONAL HELPER FUNCTIONS

export const formatCurrency = (cents) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const getStatusLabel = (status) => {
  const statusLabels = {
    DRAFT: 'Draft',
    FLOATING: 'Available',
    PLEDGED: 'Pledged',
    FULFILLED: 'Fulfilled',
    RECURRING: 'Recurring',
  };
  return statusLabels[status] || status;
};

export const getCategoryLabel = (category) => {
  const categoryLabels = {
    FOOD: 'Food',
    CLOTHING: 'Clothing',
    SERVICE: 'Service Project',
    EDUCATION: 'Education',
    HOUSING: 'Housing',
    EVENT: 'Event',
    OTHER: 'Other',
  };
  return categoryLabels[category] || category;
};

export const getNeedTypeLabel = (needType) => {
  const typeLabels = {
    ONETIME: 'One-time',
    ONGOING: 'Ongoing',
    GROUP: 'Group Project',
  };
  return typeLabels[needType] || needType;
};
