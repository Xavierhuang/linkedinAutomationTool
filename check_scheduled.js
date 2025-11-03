// Check all approved posts that were recently updated (within last hour)
print("Checking recently restored and rescheduled posts...\n");

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

const posts = db.ai_generated_posts.find({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  status: "approved",
  updated_at: { $gte: oneHourAgo }
}).sort({ updated_at: -1 }).toArray();

print("Found " + posts.length + " recently updated approved posts:\n");
posts.forEach(p => {
  print("  Content: " + p.content.substring(0, 60) + "...");
  print("  Scheduled for: " + (p.scheduled_for ? p.scheduled_for : "NOT YET SCHEDULED"));
  print("  Has Image: " + (p.image_url ? "Yes ✓" : "No"));
  print("  Campaign: " + p.campaign_id);
  print("");
});


print("Checking recently restored and rescheduled posts...\n");

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

const posts = db.ai_generated_posts.find({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  status: "approved",
  updated_at: { $gte: oneHourAgo }
}).sort({ updated_at: -1 }).toArray();

print("Found " + posts.length + " recently updated approved posts:\n");
posts.forEach(p => {
  print("  Content: " + p.content.substring(0, 60) + "...");
  print("  Scheduled for: " + (p.scheduled_for ? p.scheduled_for : "NOT YET SCHEDULED"));
  print("  Has Image: " + (p.image_url ? "Yes ✓" : "No"));
  print("  Campaign: " + p.campaign_id);
  print("");
});


print("Checking recently restored and rescheduled posts...\n");

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

const posts = db.ai_generated_posts.find({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  status: "approved",
  updated_at: { $gte: oneHourAgo }
}).sort({ updated_at: -1 }).toArray();

print("Found " + posts.length + " recently updated approved posts:\n");
posts.forEach(p => {
  print("  Content: " + p.content.substring(0, 60) + "...");
  print("  Scheduled for: " + (p.scheduled_for ? p.scheduled_for : "NOT YET SCHEDULED"));
  print("  Has Image: " + (p.image_url ? "Yes ✓" : "No"));
  print("  Campaign: " + p.campaign_id);
  print("");
});





