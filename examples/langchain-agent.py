"""
LangChain Research Agent — BrowseAI Example

Drop BrowseAI into a LangChain agent as a research tool.
The agent gets evidence-backed web research capabilities.

Usage:
    pip install browseai[langchain] langchain langchain-openai
    python langchain-agent.py
"""

from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from browseai.integrations.langchain import (
    BrowseAISearchTool,
    BrowseAIAskTool,
    BrowseAIExtractTool,
)

# BrowseAI tools — agent gets evidence-backed research
tools = [
    BrowseAISearchTool(api_key="bai_xxx"),     # Web search
    BrowseAIAskTool(api_key="bai_xxx"),         # Full research pipeline
    BrowseAIExtractTool(api_key="bai_xxx"),     # Page extraction
]

# Standard LangChain agent setup
llm = ChatOpenAI(model="gpt-4o")

prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a research assistant. Use BrowseAI tools to find
    evidence-backed answers. Always cite your sources and mention the
    confidence score. Never make claims without evidence."""),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# Run
result = executor.invoke({
    "input": "What are the top 3 JavaScript frameworks in 2025 and why?"
})

print("\n--- Result ---")
print(result["output"])
