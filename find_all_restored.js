// Check ALL approved posts updated in last 2 hours
print("Checking ALL recently updated posts...\n");

const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

const posts = db.ai_generated_posts.find({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  status: "approved",
  updated_at: { $gte: twoHoursAgo }
}).sort({ updated_at: -1 }).toArray();

print("Found " + posts.length + " posts:\n");

// Group by campaign
const campaigns = {};
posts.forEach(p => {
  if (!campaigns[p.campaign_id]) {
    campaigns[p.campaign_id] = [];
  }
  campaigns[p.campaign_id].push(p);
});

for (const campaignId in campaigns) {
  print("Campaign: " + campaignId);
  print("Posts: " + campaigns[campaignId].length);
  campaigns[campaignId].forEach(p => {
    print("  - " + p.content.substring(0, 60) + "...");
    print("    Scheduled: " + (p.scheduled_for ? new Date(p.scheduled_for).toISOString() : "NOT SCHEDULED"));
    print("    Image: " + (p.image_url ? "Yes" : "No"));
  });
  print("");
}


print("Checking ALL recently updated posts...\n");

const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

const posts = db.ai_generated_posts.find({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  status: "approved",
  updated_at: { $gte: twoHoursAgo }
}).sort({ updated_at: -1 }).toArray();

print("Found " + posts.length + " posts:\n");

// Group by campaign
const campaigns = {};
posts.forEach(p => {
  if (!campaigns[p.campaign_id]) {
    campaigns[p.campaign_id] = [];
  }
  campaigns[p.campaign_id].push(p);
});

for (const campaignId in campaigns) {
  print("Campaign: " + campaignId);
  print("Posts: " + campaigns[campaignId].length);
  campaigns[campaignId].forEach(p => {
    print("  - " + p.content.substring(0, 60) + "...");
    print("    Scheduled: " + (p.scheduled_for ? new Date(p.scheduled_for).toISOString() : "NOT SCHEDULED"));
    print("    Image: " + (p.image_url ? "Yes" : "No"));
  });
  print("");
}


print("Checking ALL recently updated posts...\n");

const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

const posts = db.ai_generated_posts.find({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  status: "approved",
  updated_at: { $gte: twoHoursAgo }
}).sort({ updated_at: -1 }).toArray();

print("Found " + posts.length + " posts:\n");

// Group by campaign
const campaigns = {};
posts.forEach(p => {
  if (!campaigns[p.campaign_id]) {
    campaigns[p.campaign_id] = [];
  }
  campaigns[p.campaign_id].push(p);
});

for (const campaignId in campaigns) {
  print("Campaign: " + campaignId);
  print("Posts: " + campaigns[campaignId].length);
  campaigns[campaignId].forEach(p => {
    print("  - " + p.content.substring(0, 60) + "...");
    print("    Scheduled: " + (p.scheduled_for ? new Date(p.scheduled_for).toISOString() : "NOT SCHEDULED"));
    print("    Image: " + (p.image_url ? "Yes" : "No"));
  });
  print("");
}





