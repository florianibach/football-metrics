FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY FootballMetrics.Api.csproj ./
RUN dotnet restore FootballMetrics.Api.csproj
COPY . .
RUN dotnet publish FootballMetrics.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
RUN mkdir -p /app/data /app/uploads
VOLUME ["/app/data", "/app/uploads"]
ENTRYPOINT ["dotnet", "FootballMetrics.Api.dll"]
