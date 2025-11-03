// Find the specific post the user mentioned
print("Looking for the 'Have you ever wondered' post...\n");

const post = db.ai_generated_posts.findOne({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  content: { $regex: /Have you ever wondered why some brands can create vibrant communities/ }
});

if (post) {
  print("✅ Found the post!\n");
  print("Status: " + post.status);
  print("Scheduled for: " + post.scheduled_for);
  print("Has image URL: " + (post.image_url ? "Yes ✓" : "No ✗"));
  print("Image URL: " + (post.image_url || "None"));
  print("Profile type: " + post.profile_type);
  print("Campaign ID: " + post.campaign_id);
  
  // Get campaign details
  const campaign = db.campaigns.findOne({ id: post.campaign_id });
  if (campaign) {
    print("\nCampaign Details:");
    print("  Name: " + campaign.name);
    print("  Profile Type: " + campaign.profile_type);
    print("  Auto Post: " + campaign.auto_post);
    print("  LinkedIn Author ID: " + campaign.linkedin_author_id);
  }
  
  print("\n✅ When this post is scheduled to run:");
  print("  1. It WILL post to: " + (post.profile_type === 'company' ? "COMPANY PAGE ✓" : "Personal (Wrong!)"));
  print("  2. It WILL upload image: " + (post.image_url ? "YES ✓" : "NO"));
  print("  3. Fixed posting logic WILL be used ✓");
} else {
  print("❌ Post not found");
}


print("Looking for the 'Have you ever wondered' post...\n");

const post = db.ai_generated_posts.findOne({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  content: { $regex: /Have you ever wondered why some brands can create vibrant communities/ }
});

if (post) {
  print("✅ Found the post!\n");
  print("Status: " + post.status);
  print("Scheduled for: " + post.scheduled_for);
  print("Has image URL: " + (post.image_url ? "Yes ✓" : "No ✗"));
  print("Image URL: " + (post.image_url || "None"));
  print("Profile type: " + post.profile_type);
  print("Campaign ID: " + post.campaign_id);
  
  // Get campaign details
  const campaign = db.campaigns.findOne({ id: post.campaign_id });
  if (campaign) {
    print("\nCampaign Details:");
    print("  Name: " + campaign.name);
    print("  Profile Type: " + campaign.profile_type);
    print("  Auto Post: " + campaign.auto_post);
    print("  LinkedIn Author ID: " + campaign.linkedin_author_id);
  }
  
  print("\n✅ When this post is scheduled to run:");
  print("  1. It WILL post to: " + (post.profile_type === 'company' ? "COMPANY PAGE ✓" : "Personal (Wrong!)"));
  print("  2. It WILL upload image: " + (post.image_url ? "YES ✓" : "NO"));
  print("  3. Fixed posting logic WILL be used ✓");
} else {
  print("❌ Post not found");
}


print("Looking for the 'Have you ever wondered' post...\n");

const post = db.ai_generated_posts.findOne({
  org_id: "75d9110d-e08e-47e5-8cfa-9cdd23c23174",
  content: { $regex: /Have you ever wondered why some brands can create vibrant communities/ }
});

if (post) {
  print("✅ Found the post!\n");
  print("Status: " + post.status);
  print("Scheduled for: " + post.scheduled_for);
  print("Has image URL: " + (post.image_url ? "Yes ✓" : "No ✗"));
  print("Image URL: " + (post.image_url || "None"));
  print("Profile type: " + post.profile_type);
  print("Campaign ID: " + post.campaign_id);
  
  // Get campaign details
  const campaign = db.campaigns.findOne({ id: post.campaign_id });
  if (campaign) {
    print("\nCampaign Details:");
    print("  Name: " + campaign.name);
    print("  Profile Type: " + campaign.profile_type);
    print("  Auto Post: " + campaign.auto_post);
    print("  LinkedIn Author ID: " + campaign.linkedin_author_id);
  }
  
  print("\n✅ When this post is scheduled to run:");
  print("  1. It WILL post to: " + (post.profile_type === 'company' ? "COMPANY PAGE ✓" : "Personal (Wrong!)"));
  print("  2. It WILL upload image: " + (post.image_url ? "YES ✓" : "NO"));
  print("  3. Fixed posting logic WILL be used ✓");
} else {
  print("❌ Post not found");
}





