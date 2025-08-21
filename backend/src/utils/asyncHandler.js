// Custom middleware function to handle asynchronous operations and errors
const asyncHandler = (requestHandler) => {
    // Returning a middleware function that takes the request, response, and next function
    return (req, res, next) => {
        // Wrapping the execution of the provided requestHandler in a Promise
        Promise.resolve(requestHandler(req, res, next))
            // Handling any errors that may occur during the asynchronous operation
            .catch((err) => next(err));
    };
};

// Exporting the asyncHandler function for use in other parts of the application
export { asyncHandler };