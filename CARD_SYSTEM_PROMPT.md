# Complete Card System Logic - Replit Prompt Template

This document provides the complete logic architecture for building a card-based system similar to Christ's Loving Hands app, extracting the core patterns for creating, displaying, and managing interactive cards with response collection.

## Core Data Architecture

### Primary Entity Schema (Card/Need)
```typescript
// Main entity that cards represent
export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  
  // Status lifecycle management
  status: text("status").notNull().default("AVAILABLE"), // DRAFT, AVAILABLE, COMMITTED, COMPLETED, RECURRING
  
  // Type classifications
  type: text("type").notNull().default("ONETIME"), // ONETIME, ONGOING, GROUP
  
  // Timing fields
  neededBy: date("needed_by"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  
  // Event-specific fields (for special card types)
  eventDate: date("event_date"),
  eventTime: text("event_time"),
  eventLocation: text("event_location"),
  
  // Financial/resource fields
  estimatedCost: integer("estimated_cost"), // stored in cents
  
  // Visual/metadata
  imageUrl: text("image_url"),
  redirectUrl: text("redirect_url"),
  isHighlighted: boolean("is_highlighted").default(false),
  
  // Group management (for collaborative cards)
  slotsNeeded: integer("slots_needed"),
  slotsFilledCount: integer("slots_filled_count").default(0),
  
  // Admin/contact fields (hidden from public)
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  contactAddress: text("contact_address"),
  adminNotes: text("admin_notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### Response/Pledge Collection Schema
```typescript
// Responses from users interacting with cards
export const responses = pgTable("responses", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id, { onDelete: 'cascade' }),
  
  // Contact information
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  
  // Response details
  notes: text("notes"),
  responseType: text("response_type").notNull(), // "items", "money", "volunteer", "custom"
  
  // Commitment tracking
  isOngoingCommitment: boolean("is_ongoing_commitment"),
  
  // Communication preferences
  subscribeToUpdates: boolean("subscribe_to_updates").default(true),
  
  // Payment/completion tracking
  paymentCompleted: boolean("payment_completed").default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### Categories and Enums
```typescript
export enum CardStatus {
  DRAFT = "DRAFT",           // Not yet published
  AVAILABLE = "AVAILABLE",   // Open for responses
  COMMITTED = "COMMITTED",   // Someone has committed to help
  COMPLETED = "COMPLETED",   // Fulfilled/finished
  RECURRING = "RECURRING",   // Cycles back to available
}

export enum CardType {
  ONETIME = "ONETIME",       // Single instance
  ONGOING = "ONGOING",       // Continuous need
  GROUP = "GROUP",           // Multiple people needed
}

export enum CardCategory {
  SERVICE = "SERVICE",
  MATERIAL = "MATERIAL", 
  FINANCIAL = "FINANCIAL",
  EVENT = "EVENT",
  EDUCATION = "EDUCATION",
  OTHER = "OTHER",
}
```

## Form Logic for Card Creation

### Dynamic Form Schema with Conditional Fields
```typescript
const cardFormSchema = insertCardSchema.extend({
  // Cost handling - keep as dollars in form, convert to cents in mutation
  estimatedCost: z.union([z.string(), z.number(), z.undefined()]).optional().transform((val) => {
    if (!val) return undefined;
    if (typeof val === "number") return val;
    return parseFloat(val); // Keep as dollars, convert in mutation
  }),
  
  // Date fields as strings for form inputs
  neededBy: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  eventDate: z.string().optional(),
  
  // Optional fields
  eventTime: z.string().optional(),
  eventLocation: z.string().optional(),
  redirectUrl: z.string().optional(),
  
  // Number fields with string->number transformation
  slotsNeeded: z.union([z.string(), z.number(), z.undefined()]).optional().transform((val) => {
    if (!val) return undefined;
    if (typeof val === "number") return val;
    const parsed = parseInt(val);
    return isNaN(parsed) ? undefined : parsed;
  }),
  
  // Admin contact fields
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  contactAddress: z.string().optional(),
  adminNotes: z.string().optional(),
});
```

### Conditional Form Fields Based on Category/Type
```typescript
// In your form component, show/hide fields based on selections:

{/* Show date/time fields for EVENT category */}
{form.watch('category') === CardCategory.EVENT && (
  <>
    <FormField name="eventDate" />
    <FormField name="eventTime" />
    <FormField name="eventLocation" />
    <FormField name="redirectUrl" />
  </>
)}

{/* Show ongoing date range for ONGOING type */}
{form.watch('type') === CardType.ONGOING && (
  <>
    <FormField name="startDate" />
    <FormField name="endDate" />
  </>
)}

{/* Show slots for GROUP type */}
{form.watch('type') === CardType.GROUP && (
  <FormField name="slotsNeeded" />
)}

{/* Show cost for FINANCIAL/MATERIAL categories */}
{(form.watch('category') === CardCategory.FINANCIAL || 
  form.watch('category') === CardCategory.MATERIAL) && (
  <FormField name="estimatedCost" />
)}
```

## API Routes Logic

### Card Management Routes
```typescript
// Create new card
app.post("/api/cards", async (req, res) => {
  try {
    // Check admin authorization
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    // Validate input
    const result = insertCardSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: "Invalid card data", 
        errors: fromZodError(result.error)
      });
    }

    // Handle status - can create as DRAFT or AVAILABLE
    const status = req.body.status ? req.body.status as CardStatus : CardStatus.AVAILABLE;
    const card = await storage.createCard(result.data, status);
    res.status(201).json(card);
  } catch (error) {
    console.error("Error creating card:", error);
    res.status(500).json({ message: "Failed to create card" });
  }
});

// Get all cards (public route with filtering)
app.get("/api/cards", async (req, res) => {
  try {
    const cards = await storage.getAllCards();
    
    // Filter out drafts for non-admin users
    const filteredCards = req.isAuthenticated() && req.user.isAdmin 
      ? cards 
      : cards.filter(card => card.status !== CardStatus.DRAFT);
    
    res.json(filteredCards);
  } catch (error) {
    console.error("Error getting cards:", error);
    res.status(500).json({ message: "Failed to retrieve cards" });
  }
});

// Update card status (for workflow management)
app.patch("/api/cards/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    // Validate status
    if (!Object.values(CardStatus).includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    
    const updatedCard = await storage.updateCardStatus(id, status);
    
    // Trigger notifications if status changed to COMMITTED
    if (status === CardStatus.COMMITTED) {
      await sendStatusChangeNotification(updatedCard);
    }
    
    res.json(updatedCard);
  } catch (error) {
    console.error("Error updating card status:", error);
    res.status(500).json({ message: "Failed to update card status" });
  }
});
```

### Response Collection Routes
```typescript
// Submit response to a card
app.post("/api/responses", async (req, res) => {
  try {
    // Validate response data
    const result = insertResponseSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: "Invalid response data", 
        errors: fromZodError(result.error)
      });
    }

    // Check if card exists and is available
    const card = await storage.getCard(result.data.cardId);
    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    if (card.status !== CardStatus.AVAILABLE && card.status !== CardStatus.RECURRING) {
      return res.status(400).json({ message: "This card is no longer accepting responses" });
    }

    // Create the response
    const response = await storage.createResponse(result.data);
    
    // Update card status based on card type
    if (card.type === CardType.GROUP) {
      // For group cards, check if slots are filled
      const responseCount = await storage.getResponseCountByCardId(card.id);
      if (card.slotsNeeded && responseCount >= card.slotsNeeded) {
        await storage.updateCardStatus(card.id, CardStatus.COMMITTED);
      }
    } else {
      // For individual cards, mark as committed
      await storage.updateCardStatus(card.id, CardStatus.COMMITTED);
    }
    
    // Send confirmation emails
    await sendResponseConfirmation(card, response);
    await sendAdminNotification(card, response);
    
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating response:", error);
    res.status(500).json({ message: "Failed to submit response" });
  }
});
```

## Card Display Component Logic

### Responsive Card Component
```typescript
const CardComponent = ({ card }: { card: Card }) => {
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  
  // Status badge styling
  const statusColors = {
    [CardStatus.DRAFT]: "bg-slate-500",
    [CardStatus.AVAILABLE]: "bg-gray-500", 
    [CardStatus.COMMITTED]: "bg-blue-600",
    [CardStatus.COMPLETED]: "bg-green-600",
    [CardStatus.RECURRING]: "bg-purple-600",
  };
  
  // Dynamic status labels
  const getStatusLabel = (status: CardStatus, type?: CardType) => {
    if (type === CardType.GROUP && status === CardStatus.AVAILABLE) {
      return "Volunteers Needed";
    }
    
    return {
      [CardStatus.DRAFT]: "Draft",
      [CardStatus.AVAILABLE]: "Available", 
      [CardStatus.COMMITTED]: "Committed",
      [CardStatus.COMPLETED]: "Completed",
      [CardStatus.RECURRING]: "Recurring",
    }[status] || status;
  };
  
  // Currency formatting
  const formatCurrency = (amount?: number) => {
    if (!amount) return "";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100); // Convert from cents
  };
  
  // Date formatting with timezone handling
  const formatDate = (date?: Date | string | null) => {
    if (!date) return "Not specified";
    const inputDate = new Date(date);
    const userTimezoneOffset = inputDate.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(inputDate.getTime() + userTimezoneOffset);
    return adjustedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    });
  };
  
  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg leading-tight line-clamp-2">
            {card.title}
          </h3>
          <Badge className={`${statusColors[card.status]} text-white shrink-0`}>
            {getStatusLabel(card.status, card.type)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 pb-3">
        {/* Description */}
        <div className="text-sm text-gray-600 line-clamp-3 mb-3" 
             dangerouslySetInnerHTML={{ __html: card.description }} />
        
        {/* Metadata container */}
        <div className="bg-gray-50 p-2 rounded-md mt-1 flex items-center justify-between text-xs">
          <div className="flex items-center">
            <CalendarIcon className="h-3.5 w-3.5 mr-1 text-blue-600" />
            <span className="font-medium">
              {card.eventDate ? (
                <>Event: {formatDate(card.eventDate)}</>
              ) : card.neededBy ? (
                <>By: {formatDate(card.neededBy)}</>
              ) : card.type === CardType.GROUP ? (
                <>Group Project</>
              ) : card.type === CardType.ONGOING ? (
                <>Ongoing</>
              ) : (
                <>One-time</>
              )}
            </span>
          </div>
          {card.estimatedCost && (
            <span className="text-red-600 font-semibold">
              {formatCurrency(card.estimatedCost)}
            </span>
          )}
        </div>
        
        {/* Group slots display */}
        {card.type === CardType.GROUP && card.slotsNeeded && (
          <div className="mt-2 text-xs text-gray-600">
            {card.slotsFilledCount || 0} of {card.slotsNeeded} volunteers signed up
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-3">
        <div className="flex gap-2 w-full">
          {/* Primary action button */}
          {card.status === CardStatus.AVAILABLE || card.status === CardStatus.RECURRING ? (
            <Button 
              onClick={() => setIsResponseModalOpen(true)}
              className="flex-1 bg-red-600 hover:bg-blue-600 text-white font-bold rounded-full"
            >
              {card.type === CardType.GROUP ? "Join Project" : "I Can Help"}
            </Button>
          ) : (
            <Button variant="outline" disabled className="flex-1 rounded-full">
              {getStatusLabel(card.status, card.type)}
            </Button>
          )}
          
          {/* Secondary actions */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleShare()}
            className="rounded-full px-3"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
      
      {/* Response Modal */}
      <Dialog open={isResponseModalOpen} onOpenChange={setIsResponseModalOpen}>
        <ResponseForm card={card} onClose={() => setIsResponseModalOpen(false)} />
      </Dialog>
    </Card>
  );
};
```

## Response Form Component Logic

### Mobile-Responsive Modal Form
```typescript
const ResponseForm = ({ card, onClose }: { card: Card; onClose: () => void }) => {
  const form = useForm<ResponseFormValues>({
    resolver: zodResolver(responseFormSchema),
    defaultValues: {
      cardId: card.id,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      notes: "",
      responseType: "items", // Default response type
      isOngoingCommitment: card.type === CardType.ONGOING ? false : undefined,
      subscribeToUpdates: true,
      paymentCompleted: false,
    },
  });
  
  return (
    <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader className="flex-shrink-0">
        <DialogTitle>Respond to: {card.title}</DialogTitle>
        <DialogDescription>
          {card.type === CardType.ONGOING && (
            <span className="block mt-2 text-sm text-blue-600">
              This is an ongoing commitment
              {card.startDate && card.endDate && (
                <> from {formatDate(card.startDate)} to {formatDate(card.endDate)}</>
              )}
            </span>
          )}
        </DialogDescription>
      </DialogHeader>
      
      <div className="flex-1 overflow-y-auto px-1">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6 my-4">
            {/* Contact fields */}
            <div className="sm:col-span-3">
              <FormField name="firstName" label="First name" />
            </div>
            <div className="sm:col-span-3">
              <FormField name="lastName" label="Last name" />
            </div>
            <div className="sm:col-span-6">
              <FormField name="email" label="Email" type="email" />
            </div>
            <div className="sm:col-span-6">
              <FormField name="phone" label="Phone (optional)" />
            </div>
            <div className="sm:col-span-6">
              <FormField name="notes" label="Additional Notes" as="textarea" />
            </div>
            
            {/* Response type selection (if card has cost) */}
            {card.estimatedCost && (
              <div className="sm:col-span-6">
                <RadioGroup>
                  <RadioGroupItem value="items" label="I will provide the items" />
                  <RadioGroupItem 
                    value="money" 
                    label={`I will donate money (${formatCurrency(card.estimatedCost)})`} 
                  />
                </RadioGroup>
              </div>
            )}
            
            {/* Ongoing commitment checkbox */}
            {card.type === CardType.ONGOING && (
              <div className="sm:col-span-6">
                <Checkbox name="isOngoingCommitment">
                  I commit to helping on an ongoing basis
                </Checkbox>
              </div>
            )}
            
            {/* Email subscription */}
            <div className="sm:col-span-6">
              <Checkbox name="subscribeToUpdates">
                Keep me updated about similar opportunities
              </Checkbox>
            </div>
          </div>
          
          <DialogFooter className="pt-4 border-t bg-white sticky bottom-0 mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting..." : "Submit Response"}
            </Button>
          </DialogFooter>
        </form>
      </div>
    </DialogContent>
  );
};
```

## Storage Implementation

### Database Storage Class
```typescript
export class DatabaseStorage implements IStorage {
  // Card methods
  async createCard(card: InsertCard, status?: CardStatus): Promise<Card> {
    const cardData = { ...card, status: status || CardStatus.AVAILABLE };
    const [newCard] = await db.insert(cards).values(cardData).returning();
    return newCard;
  }
  
  async getAllCards(): Promise<Card[]> {
    return await db.select().from(cards).orderBy(desc(cards.createdAt));
  }
  
  async getCard(id: number): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    return card;
  }
  
  async updateCardStatus(id: number, status: CardStatus): Promise<Card | undefined> {
    const [updatedCard] = await db
      .update(cards)
      .set({ status, updatedAt: new Date() })
      .where(eq(cards.id, id))
      .returning();
    return updatedCard;
  }
  
  // Response methods
  async createResponse(response: InsertResponse): Promise<Response> {
    const [newResponse] = await db.insert(responses).values(response).returning();
    return newResponse;
  }
  
  async getResponsesByCardId(cardId: number): Promise<Response[]> {
    return await db.select().from(responses).where(eq(responses.cardId, cardId));
  }
  
  async getResponseCountByCardId(cardId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(responses)
      .where(eq(responses.cardId, cardId));
    return result.count;
  }
}
```

## Key Implementation Patterns

### 1. Status Lifecycle Management
- Cards flow through predictable states: DRAFT → AVAILABLE → COMMITTED → COMPLETED
- Status changes trigger notifications and business logic
- RECURRING cards cycle back to AVAILABLE after completion

### 2. Type-Based Behavior
- **ONETIME**: Single response commits the card
- **ONGOING**: Responses commit for duration with time boundaries  
- **GROUP**: Multiple responses until slots filled

### 3. Currency Handling
- Store as integers (cents) in database
- Display as formatted currency ($XX.XX)
- Form inputs accept dollars, convert to cents in mutations

### 4. Mobile-First Responsive Design
- Cards in responsive grid (1-3 columns based on screen size)
- Mobile-optimized response modals with scrolling
- Touch-friendly buttons and inputs

### 5. Email Integration Hooks
- Response confirmation to user
- Admin notifications on new responses
- Status change notifications

This system provides a complete foundation for any card-based interaction platform where users can browse opportunities and respond with commitments, payments, or volunteer signups.