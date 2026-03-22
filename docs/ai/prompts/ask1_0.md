Today, my company built a learning management system that now has 60,000 students learning. I want to develop a notification service for it. As I mentioned, my learning management system now has a large number of students using it.

Currently, my backend is monolithic, but it performs well, so we have no issues with day-to-day work on the LMS. Now I want to implement notification services—send notifications to students to inform them of their tasks and other related updates—but I think that the large amount of student activity using my main backend would make it a mess.

I decided to develop this notification service as a separate backend service and built it as a generic solution that my company can use for all future projects.

I want to do some research on how to implement this service so it can be performed well and discuss architectures with you. I want to get my final idea, architecture decisions, and other related decisions, such as performance decisions. I will roughly explain what I expect to do with this notification service.

mainly service I/O for version ( 1.0.0 )

input => notification service => output

inputs: 
- Direct REST API 
outputs:
- Email
- SMS
- Push Notification

what i want to know is 
- How to implement this service so it can be performed well?
- What are the architecture decisions I need to make?
- What are the other related decisions, such as performance decisions?
- how i intigrate local sms service to this service ( im in srilanka ) ?
- how i Push Notification ( for web , mobile ) ?
- what is the best tech stack for low compute-resorce useage and high availability and performance?
- how i organoze codebase for future proof and scalability?
- how i document this service for other developers to use it?

i want to be a best software engineer so i want to follow best practices and standards in software development.



