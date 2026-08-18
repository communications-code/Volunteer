
# Need Creation and Pledge System Export

This document contains all the components needed to replicate the need creation and pledge system from Christ's Loving Hands application.

## 1. Database Schema

### Needs Table Schema
```sql
CREATE TABLE needs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  needed_by DATE,
  event_date DATE,
  event_time TEXT,
  event_location TEXT,
  status TEXT NOT NULL DEFAULT 'FLOATING',
  estimated_cost INTEGER,
  need_type TEXT NOT NULL DEFAULT 'ONETIME',
  start_date DATE,
  end_date DATE,
  image_url TEXT,
  redirect_url TEXT,
  volunteers_needed INTEGER,
  volunteers_count INTEGER DEFAULT 0,
  is_highlighted BOOLEAN DEFAULT false,
  recipient_name TEXT,
  recipient_phone TEXT,
  recipient_email TEXT,
  recipient_address TEXT,
  recipient_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Pledges Table Schema
```sql
CREATE TABLE pledges (
  id SERIAL PRIMARY KEY,
  need_id INTEGER NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  donation_type TEXT NOT NULL,
  is_ongoing_commitment BOOLEAN,
  subscribe_to_emails BOOLEAN DEFAULT true,
  payment_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## 2. Data Models and Validation Schemas

### Enums
```typescript
export enum NeedStatus {
  DRAFT = "DRAFT",
  FLOATING = "FLOATING",
  PLEDGED = "PLEDGED",
  FULFILLED = "FULFILLED",
  RECURRING = "RECURRING",
}

export enum NeedCategory {
  FOOD = "FOOD",
  CLOTHING = "CLOTHING",
  SERVICE = "SERVICE",
  EDUCATION = "EDUCATION",
  HOUSING = "HOUSING",
  EVENT = "EVENT",
  OTHER = "OTHER",
}

export enum NeedType {
  ONETIME = "ONETIME",
  ONGOING = "ONGOING",
  GROUP = "GROUP",
}
```

### Validation Schemas (Zod)
```typescript
import { z } from "zod";

export const insertNeedSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  neededBy: z.string().optional(),
  eventDate: z.string().optional(),
  eventTime: z.string().optional(),
  eventLocation: z.string().optional(),
  status: z.string().optional(),
  estimatedCost: z.number().optional(),
  needType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  imageUrl: z.string().optional(),
  redirectUrl: z.string().optional(),
  volunteersNeeded: z.number().optional(),
  recipientName: z.string().optional(),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().optional(),
  recipientAddress: z.string().optional(),
  recipientNotes: z.string().optional(),
});

export const insertPledgeSchema = z.object({
  needId: z.number(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  donationType: z.enum(["items", "money"]),
  isOngoingCommitment: z.boolean().optional(),
  subscribeToEmails: z.boolean().optional(),
  paymentCompleted: z.boolean().optional(),
});
```

## 3. API Endpoints

### Need Management Endpoints

#### GET /api/needs
```typescript
app.get("/api/needs", async (req, res) => {
  try {
    const needs = await storage.getAllNeeds();
    res.json(needs);
  } catch (error) {
    console.error("Error getting needs:", error);
    res.status(500).json({ message: "Failed to retrieve needs" });
  }
});
```

#### POST /api/needs (Create Need)
```typescript
app.post("/api/needs", async (req, res) => {
  try {
    // Authentication check would go here
    
    const result = insertNeedSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: "Invalid need data", 
        errors: fromZodError(result.error)
      });
    }

    const status = req.body.status ? req.body.status as NeedStatus : undefined;
    const need = await storage.createNeed(result.data, status);
    res.status(201).json(need);
  } catch (error) {
    console.error("Error creating need:", error);
    res.status(500).json({ message: "Failed to create need" });
  }
});
```

#### PUT /api/needs/:id (Update Need)
```typescript
app.put("/api/needs/:id", async (req, res) => {
  try {
    // Authentication check would go here
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid need ID" });
    }

    const existingNeed = await storage.getNeed(id);
    if (!existingNeed) {
      return res.status(404).json({ message: "Need not found" });
    }

    const result = insertNeedSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: "Invalid need data", 
        errors: fromZodError(result.error)
      });
    }

    const updatedNeed = await storage.updateNeed(id, result.data);
    res.json(updatedNeed);
  } catch (error) {
    console.error("Error updating need:", error);
    res.status(500).json({ message: "Failed to update need" });
  }
});
```

### Pledge Management Endpoints

#### POST /api/pledges (Create Pledge)
```typescript
app.post("/api/pledges", async (req, res) => {
  try {
    const result = insertPledgeSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: "Invalid pledge data", 
        errors: fromZodError(result.error)
      });
    }

    const need = await storage.getNeed(result.data.needId);
    if (!need) {
      return res.status(404).json({ message: "Need not found" });
    }

    if (need.status !== NeedStatus.FLOATING && need.status !== NeedStatus.RECURRING) {
      return res.status(400).json({ 
        message: "This need has already been pledged or fulfilled" 
      });
    }

    const pledge = await storage.createPledge(result.data);
    
    // Update need status for non-recurring needs
    if (need.status === NeedStatus.FLOATING) {
      await storage.updateNeedStatus(need.id, NeedStatus.PLEDGED);
    }
    
    res.status(201).json(pledge);
  } catch (error) {
    console.error("Error creating pledge:", error);
    res.status(500).json({ message: "Failed to create pledge" });
  }
});
```

#### GET /api/needs/:id/pledges (Get Pledges for Need)
```typescript
app.get("/api/needs/:id/pledges", async (req, res) => {
  try {
    // Authentication check would go here
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid need ID" });
    }

    const pledges = await storage.getPledgesByNeedId(id);
    res.json(pledges);
  } catch (error) {
    console.error("Error getting pledges:", error);
    res.status(500).json({ message: "Failed to retrieve pledges" });
  }
});
```

## 4. Database Operations (Storage Layer)

### Need Operations
```typescript
class DatabaseStorage {
  async createNeed(needData: InsertNeed, status?: NeedStatus): Promise<Need> {
    const needToInsert = {
      ...needData,
      status: status || NeedStatus.FLOATING,
      estimatedCost: needData.estimatedCost || null,
      neededBy: needData.neededBy || null,
      startDate: needData.startDate || null,
      endDate: needData.endDate || null,
      eventDate: needData.eventDate || null,
      volunteersNeeded: needData.volunteersNeeded || null,
      updatedAt: new Date(),
    };

    const [need] = await db.insert(needs).values(needToInsert).returning();
    return need;
  }

  async getAllNeeds(): Promise<Need[]> {
    return await db.select().from(needs).orderBy(desc(needs.createdAt));
  }

  async getNeed(id: number): Promise<Need | undefined> {
    const [need] = await db.select().from(needs).where(eq(needs.id, id));
    return need;
  }

  async updateNeed(id: number, needData: Partial<InsertNeed>): Promise<Need | undefined> {
    const [updatedNeed] = await db
      .update(needs)
      .set({ ...needData, updatedAt: new Date() })
      .where(eq(needs.id, id))
      .returning();
    return updatedNeed;
  }

  async updateNeedStatus(id: number, status: NeedStatus): Promise<Need | undefined> {
    const [updatedNeed] = await db
      .update(needs)
      .set({ status, updatedAt: new Date() })
      .where(eq(needs.id, id))
      .returning();
    return updatedNeed;
  }

  async deleteNeed(id: number): Promise<boolean> {
    const result = await db.delete(needs).where(eq(needs.id, id));
    return result.rowCount > 0;
  }
}
```

### Pledge Operations
```typescript
class DatabaseStorage {
  async createPledge(pledgeData: InsertPledge): Promise<Pledge> {
    const [pledge] = await db.insert(pledges).values(pledgeData).returning();
    return pledge;
  }

  async getPledge(id: number): Promise<Pledge | undefined> {
    const [pledge] = await db.select().from(pledges).where(eq(pledges.id, id));
    return pledge;
  }

  async getPledgesByNeedId(needId: number): Promise<Pledge[]> {
    return await db.select().from(pledges).where(eq(pledges.needId, needId));
  }
}
```

## 5. Frontend Form Components

### Need Creation Form Data Collection
The form collects the following data:
- **Basic Info**: title, description, category
- **Timing**: neededBy, eventDate, eventTime, startDate, endDate
- **Type**: needType (ONETIME, ONGOING, GROUP)
- **Cost**: estimatedCost (in cents)
- **Location**: eventLocation (for events)
- **Volunteers**: volunteersNeeded (for group projects)
- **Media**: imageUrl
- **Redirects**: redirectUrl (for event signups)
- **Status**: status (DRAFT, FLOATING, RECURRING)
- **Admin Fields**: recipient contact information

### Pledge Form Data Collection
The pledge form collects:
- **Personal**: firstName, lastName, email, phone
- **Commitment**: donationType (items/sign-up), isOngoingCommitment
- **Communication**: notes, subscribeToEmails
- **Payment**: financial contribution checkout is disabled for VFW

## 6. Business Logic Rules

### Need Status Transitions
1. **DRAFT** → **FLOATING**: When published
2. **FLOATING** → **PLEDGED**: When first pledge received (non-recurring)
3. **PLEDGED** → **FULFILLED**: Via admin action or email token
4. **RECURRING**: Accepts multiple pledges, doesn't change status

### Pledge Processing
1. Validate pledge data against need availability
2. Create pledge record
3. Update need status if applicable
4. Send confirmation emails
5. Subscribe to newsletter if opted in

## 7. Email Notifications

The system sends emails for:
- Pledge confirmations to donors
- Pledge notifications to admins
- Fulfillment tokens for easy status updates

## 8. File Upload System

Supports image uploads for needs with:
- Base64 encoding
- File type validation (JPEG, PNG, GIF, WebP)
- Unique filename generation
- Static file serving

This export contains all the core components needed to replicate the need creation and pledge system in another application.
