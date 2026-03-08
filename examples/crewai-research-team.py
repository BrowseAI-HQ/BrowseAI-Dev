"""
CrewAI Research Team — BrowseAI Example

A multi-agent research team using CrewAI + BrowseAI.
One agent researches, another analyzes and summarizes.

Usage:
    pip install browseai[crewai] crewai
    python crewai-research-team.py
"""

from crewai import Agent, Task, Crew
from browseai.integrations.crewai import BrowseAITool

# BrowseAI as a CrewAI tool
browse_tool = BrowseAITool(api_key="bai_xxx")

# Agent 1: Researcher — finds evidence-backed information
researcher = Agent(
    role="Senior Research Analyst",
    goal="Find accurate, evidence-backed information about the given topic",
    backstory="You are a meticulous researcher who never makes claims without sources.",
    tools=[browse_tool],
    verbose=True,
)

# Agent 2: Writer — synthesizes research into a report
writer = Agent(
    role="Technical Writer",
    goal="Create clear, well-structured reports from research findings",
    backstory="You turn complex research into readable summaries with proper citations.",
    verbose=True,
)

# Tasks
research_task = Task(
    description="Research the current state of AI agent frameworks in 2025. "
    "Find the top frameworks, their key features, and adoption trends. "
    "Use BrowseAI to get evidence-backed results with confidence scores.",
    expected_output="Detailed research findings with sources and confidence scores",
    agent=researcher,
)

report_task = Task(
    description="Using the research findings, write a concise comparison report "
    "of AI agent frameworks. Include pros, cons, and recommendations. "
    "Cite all sources from the research.",
    expected_output="A structured comparison report with citations",
    agent=writer,
)

# Run the crew
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, report_task],
    verbose=True,
)

result = crew.kickoff()
print("\n--- Final Report ---")
print(result)
