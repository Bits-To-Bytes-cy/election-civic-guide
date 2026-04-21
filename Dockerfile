FROM nginx:alpine

# Copy the static website files (index.html, src/, etc.) to the Nginx HTML directory
COPY . /usr/share/nginx/html

# Expose port 80 (Cloud Run can route to port 80 natively)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
