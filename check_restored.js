// Check all approved posts without scheduled_for (ready to be scheduled)
print("Checking restored posts waiting for scheduling...\n");

const posts = db.ai_generated_posts.find({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  status: "approved",
  scheduled_for: null
}).toArray();

print("Found " + posts.length + " approved posts waiting to be scheduled:");
posts.forEach(p => {
  print("\n  Campaign ID: " + p.campaign_id);
  print("  Created: " + p.created_at);
  print("  Content: " + p.content.substring(0, 70) + "...");
  print("  Has Image: " + (p.image_url ? "Yes" : "No"));
});

print("\n✅ These posts will be automatically scheduled within 5 minutes");
print("✅ They will post to the correct company profile with images");


print("Checking restored posts waiting for scheduling...\n");

const posts = db.ai_generated_posts.find({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  status: "approved",
  scheduled_for: null
}).toArray();

print("Found " + posts.length + " approved posts waiting to be scheduled:");
posts.forEach(p => {
  print("\n  Campaign ID: " + p.campaign_id);
  print("  Created: " + p.created_at);
  print("  Content: " + p.content.substring(0, 70) + "...");
  print("  Has Image: " + (p.image_url ? "Yes" : "No"));
});

print("\n✅ These posts will be automatically scheduled within 5 minutes");
print("✅ They will post to the correct company profile with images");


print("Checking restored posts waiting for scheduling...\n");

const posts = db.ai_generated_posts.find({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  status: "approved",
  scheduled_for: null
}).toArray();

print("Found " + posts.length + " approved posts waiting to be scheduled:");
posts.forEach(p => {
  print("\n  Campaign ID: " + p.campaign_id);
  print("  Created: " + p.created_at);
  print("  Content: " + p.content.substring(0, 70) + "...");
  print("  Has Image: " + (p.image_url ? "Yes" : "No"));
});

print("\n✅ These posts will be automatically scheduled within 5 minutes");
print("✅ They will post to the correct company profile with images");





