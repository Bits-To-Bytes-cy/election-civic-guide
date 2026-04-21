FROM nginx:alpine

# Copy the static website files (index.html, src/, etc.) to the Nginx HTML directory
COPY . /usr/share/nginx/html

# Cloud Run provides a PORT environment variable dynamically
# We use sed to replace Nginx's default listen port (80) with the $PORT variable at runtime
CMD sed -i -e 's/listen  *80;/listen '"$PORT"';/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'
