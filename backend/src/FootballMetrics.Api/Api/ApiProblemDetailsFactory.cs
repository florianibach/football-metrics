using Microsoft.AspNetCore.Mvc;

namespace FootballMetrics.Api.Api;

public static class ApiProblemDetailsFactory
{
    public static ObjectResult Create(
        ControllerBase controller,
        int statusCode,
        string title,
        string detail,
        string errorCode)
    {
        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
            Instance = controller.HttpContext?.Request?.Path.Value
        };

        problemDetails.Extensions["errorCode"] = errorCode;

        return controller.StatusCode(statusCode, problemDetails);
    }
}
