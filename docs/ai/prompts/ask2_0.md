i want to impliment feature like bulk notification send 
--- this works like when backend has their database with all user data ans stuff 
--- admin panel say think they want to send notification for specific group of users 
--- then instead of sending notification one by one to each user 
--- they can send notification to all users in that group at trigering a notification service one time 
--- but notification service not direct connect with main backend db , we do like create some standand for main backend to register 
--- endpoints for notification service to call and pass data like user group data then service call that endpoint time to time get data and send notifications 
--- all notification related data always store in notification service db 
--- notification service db is separate from main backend db 
--- notification service db is used only for notification related data 
--- main backend db is used for all other data 

