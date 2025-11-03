// Restore posts that were incorrectly posted to personal account
const result = db.ai_generated_posts.updateMany(
  {
    org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
    status: "posted",
    posted_at: {
      $gte: new Date("2025-10-25T00:00:00Z"),
      $lte: new Date("2025-10-25T23:59:59Z")
    }
  },
  {
    $set: {
      status: "approved",
      updated_at: new Date()
    },
    $unset: {
      posted_at: "",
      linkedin_post_id: "",
      platform_url: "",
      scheduled_for: ""
    }
  }
);

print("✅ Restored " + result.modifiedCount + " posts to approved status");
print("They will be automatically rescheduled within 5 minutes");


const result = db.ai_generated_posts.updateMany(
  {
    org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
    status: "posted",
    posted_at: {
      $gte: new Date("2025-10-25T00:00:00Z"),
      $lte: new Date("2025-10-25T23:59:59Z")
    }
  },
  {
    $set: {
      status: "approved",
      updated_at: new Date()
    },
    $unset: {
      posted_at: "",
      linkedin_post_id: "",
      platform_url: "",
      scheduled_for: ""
    }
  }
);

print("✅ Restored " + result.modifiedCount + " posts to approved status");
print("They will be automatically rescheduled within 5 minutes");


const result = db.ai_generated_posts.updateMany(
  {
    org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
    status: "posted",
    posted_at: {
      $gte: new Date("2025-10-25T00:00:00Z"),
      $lte: new Date("2025-10-25T23:59:59Z")
    }
  },
  {
    $set: {
      status: "approved",
      updated_at: new Date()
    },
    $unset: {
      posted_at: "",
      linkedin_post_id: "",
      platform_url: "",
      scheduled_for: ""
    }
  }
);

print("✅ Restored " + result.modifiedCount + " posts to approved status");
print("They will be automatically rescheduled within 5 minutes");





