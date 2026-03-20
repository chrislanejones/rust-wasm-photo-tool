import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Extended user profile (supplements authTables users)
  userProfiles: defineTable({
    userId: v.id("users"),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("team")),
    dailyUsage: v.number(),
    usageResetAt: v.number(),
    avatarUrl: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  subscriptions: defineTable({
    userId: v.id("users"),
    stripeCustomerId: v.string(),
    stripeSubId: v.string(),
    plan: v.union(v.literal("pro"), v.literal("team")),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due")
    ),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_stripeSubId", ["stripeSubId"]),

  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    isPublic: v.boolean(),
    shareToken: v.optional(v.string()),
    imageCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_shareToken", ["shareToken"]),

  images: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    originalUrl: v.string(),
    processedUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    filename: v.string(),
    mimeType: v.string(),
    width: v.number(),
    height: v.number(),
    sizeBytes: v.number(),
    altText: v.optional(v.string()),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_projectId_order", ["projectId", "order"]),

  layers: defineTable({
    imageId: v.id("images"),
    name: v.string(),
    order: v.number(),
    visible: v.boolean(),
    locked: v.boolean(),
    opacity: v.number(),
    blendMode: v.union(
      v.literal("normal"),
      v.literal("multiply"),
      v.literal("screen"),
      v.literal("overlay"),
      v.literal("darken"),
      v.literal("lighten"),
      v.literal("color-dodge"),
      v.literal("color-burn"),
      v.literal("hard-light"),
      v.literal("soft-light"),
      v.literal("difference"),
      v.literal("exclusion")
    ),
  })
    .index("by_imageId", ["imageId"])
    .index("by_imageId_order", ["imageId", "order"]),

  annotations: defineTable({
    imageId: v.id("images"),
    layerId: v.id("layers"),
    type: v.union(
      v.literal("rect"),
      v.literal("ellipse"),
      v.literal("path"),
      v.literal("text"),
      v.literal("arrow")
    ),
    data: v.any(),
    style: v.object({
      stroke: v.optional(v.string()),
      fill: v.optional(v.string()),
      opacity: v.optional(v.number()),
      strokeWidth: v.optional(v.number()),
      fontSize: v.optional(v.number()),
    }),
    transform: v.object({
      x: v.number(),
      y: v.number(),
      rotation: v.number(),
      scale: v.number(),
    }),
    locked: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_imageId", ["imageId"])
    .index("by_layerId", ["layerId"]),

  history: defineTable({
    imageId: v.id("images"),
    userId: v.id("users"),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("ai_rembg"),
      v.literal("ai_upscale"),
      v.literal("ai_inpaint"),
      v.literal("ai_alt")
    ),
    target: v.union(
      v.literal("annotation"),
      v.literal("layer"),
      v.literal("image")
    ),
    targetId: v.string(),
    prevState: v.optional(v.any()),
    nextState: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_imageId", ["imageId"])
    .index("by_imageId_createdAt", ["imageId", "createdAt"]),

  ai_jobs: defineTable({
    userId: v.id("users"),
    imageId: v.id("images"),
    type: v.union(
      v.literal("rembg"),
      v.literal("upscale"),
      v.literal("inpaint"),
      v.literal("alt")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed")
    ),
    replicateId: v.optional(v.string()),
    input: v.any(),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_imageId", ["imageId"])
    .index("by_replicateId", ["replicateId"])
    .index("by_status", ["status"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
