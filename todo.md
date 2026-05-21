Now I want to create an AI agentic workflow for this project development.

I explained my whole idea about this agentic workflow development. The thing is, we are using AI coding agent tools for our development, like Claude code and Opencode, but every time we create a new session, that session loses the project context. So we have to analyze the project again and again, which wastes tokens. I want to reduce that by using memory files. Then, when we create a new session, the agent can read our current implementation and the memory file to get context easily, allowing us to continue implementation without using most of the tokens to re‑analyze the project.

The first task is to create an agent folder. This folder should contain a memory file, a checksum file, a current implementation file, and markdown files for the coding agent to design the implementations that are currently available.

I want to update the agent.md file to serve as an entry point for the agent workflow.After any code change, feature implementation, bug fix, or anything related to the codebase, I want to give the LLM or coding agent instruction to always update the memory file.Future sessions can read those memory files repeatedly, gaining an understanding of the project context and continuous development, and being aware of the coding tool, the CLI tool, or sessions. All the memory items belong to the project.

I think you got the idea. What I want to do is, if you have any questions, feel free to ask me, and I will provide clear guidance or answers for the equations before starting implementation.

This is the initialization of this agent workflow process. So you want to create initial files for that.

-------------------

Remove all project overview–related content from the agent.md file because it always explains the agentic workflow. In the agentic workflow, create an overview.md file to provide a brief overview of the project without too many details. If detailed information is needed, the coding tool can read the files and retrieve the necessary details.

-------------------

